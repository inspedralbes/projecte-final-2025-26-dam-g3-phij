const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_HISTORY_ITEMS = 14;
const MIN_DAY_LIMIT = 30;
const ACTIONS_PER_DAY = 3;
const DAY_PHASES = ['mañana', 'tarde', 'noche'];
const DEFAULT_DAY_LIMIT_FALLBACK = MIN_DAY_LIMIT;
const MAX_SYNC_OPTIONS = 6;
const NARRATIVE_SETTINGS_CACHE_TTL_MS = 30000;

const DEFAULT_SYSTEM_PROMPT = `Eres el narrador principal de "Valkrypt", un RPG de fantasía oscura.
Reglas globales:
- Responde siempre en español.
- Mantén un tono inmersivo, tenso y cinematográfico.
- Integra la acción del jugador de forma coherente con el contexto previo.
- Avanza la trama con consecuencias claras.
- Escribe la narrativa de forma desarrollada y natural, sin límite estricto de palabras. Evita respuestas telegráficas.
- Si la acción del jugador es violenta, imprudente o desafiante, prioriza eventos de combate.
- Debe aparecer una situación de combate con frecuencia (aprox. cada 2 acciones).
- Si hay combate, usa tipo_combate válido: escaramuza, elite o jefe.
- Si no hay combate, usa tipo_combate: ninguno.

Debes responder SIEMPRE en este formato exacto:
<NARRATIVA>
Texto narrativo aquí
</NARRATIVA>
<DECISIONES>
1) [id:accion_valida_1] Opción 1
2) [id:accion_valida_2] Opción 2
3) [id:accion_valida_3] Opción 3
</DECISIONES>
<EVENTOS>
combate: si|no
tipo_combate: escaramuza|elite|jefe|ninguno
enemigo: nombre corto o ninguno
entorno: lugar corto
tono: descriptor corto
</EVENTOS>`.trim();

const DEFAULT_INITIAL_OPTIONS = [
    { id: 'explorar', label: 'Explorar la zona', type: 'narrative' },
    { id: 'avanzar', label: 'Avanzar por el sendero', type: 'narrative' },
    { id: 'revisar_equipo', label: 'Revisar equipo y recursos', type: 'narrative' }
];

const DEFAULT_NARRATIVE_SETTINGS = {
    key: 'global',
    defaultDayLimit: DEFAULT_DAY_LIMIT_FALLBACK,
    introTemplate: 'La crónica "{campaignTitle}" comienza en {locationName}. Las decisiones del grupo moldearán el destino del reino. Nadie conoce aún la magnitud de lo que aguarda bajo la piedra.',
    tutorialTemplate: 'TUTORIAL DE CAMPAÑA:\n1) Cada día se divide en mañana, tarde y noche (3 acciones por día).\n2) Coordina cada turno según el tramo horario actual.\n3) La campaña termina cuando se agotan los días del capítulo.\n4) Te quedan {dayLimit} días para resolver esta misión principal.',
    initialOptions: DEFAULT_INITIAL_OPTIONS,
    generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 4096
    },
    systemPrompt: DEFAULT_SYSTEM_PROMPT
};

let narrativeSettingsCache = {
    fetchedAt: 0,
    value: DEFAULT_NARRATIVE_SETTINGS
};

function normalizeHistory(storyHistory) {
    if (!Array.isArray(storyHistory)) return [];
    return storyHistory
        .filter(item => item?.text)
        .slice(-MAX_HISTORY_ITEMS)
        .map(item => ({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: item.text.trim() }]
        }));
}

function extractTextFromEvent(payload) {
    const parts = payload?.candidates?.[0]?.content?.parts || payload?.serverContent?.modelTurn?.parts;
    return Array.isArray(parts) ? parts.map(p => p.text).join('') : '';
}

function writeEventToResponse(rawEvent, res) {
    const lines = rawEvent
        .split(/\r?\n/)
        .filter(l => l.startsWith('data:'))
        .map(l => l.slice(5).trimStart())
        .join('\n')
        .trim();
    if (!lines || lines === '[DONE]') return 0;
    try {
        const payload = JSON.parse(lines);
        const text = extractTextFromEvent(payload);
        if (text) { res.write(text); return text.length; }
    } catch (e) {}
    return 0;
}

function normalizeHeroEffects(rawEffects) {
    const source = rawEffects && typeof rawEffects === 'object' ? rawEffects : {};
    return {
        healMin: Number.isFinite(Number(source.healMin)) ? Math.max(0, Math.floor(Number(source.healMin))) : 0,
        healMax: Number.isFinite(Number(source.healMax)) ? Math.max(0, Math.floor(Number(source.healMax))) : 0,
        attack: Number.isFinite(Number(source.attack)) ? Math.floor(Number(source.attack)) : 0,
        defense: Number.isFinite(Number(source.defense)) ? Math.floor(Number(source.defense)) : 0,
        healPower: Number.isFinite(Number(source.healPower)) ? Math.floor(Number(source.healPower)) : 0,
        skillAccuracy: Number.isFinite(Number(source.skillAccuracy)) ? Math.floor(Number(source.skillAccuracy)) : 0,
        enemyAccuracyPenalty: Number.isFinite(Number(source.enemyAccuracyPenalty)) ? Math.floor(Number(source.enemyAccuracyPenalty)) : 0,
        cleanse: Boolean(source.cleanse)
    };
}

function normalizeHeroItem(rawItem, fallbackId = '') {
    const itemType = rawItem?.type === 'equipment' ? 'equipment' : 'consumable';
    const quantityRaw = Number(rawItem?.quantity);
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 1;
    return {
        id: String(rawItem?.id || fallbackId || `item_${Date.now()}`),
        name: rawItem?.name ? String(rawItem.name) : (itemType === 'equipment' ? 'Equipo' : 'Consumible'),
        type: itemType,
        subtype: rawItem?.subtype ? String(rawItem.subtype) : '',
        slot: rawItem?.slot ? String(rawItem.slot) : '',
        quantity,
        description: rawItem?.description ? String(rawItem.description) : '',
        effects: normalizeHeroEffects(rawItem?.effects)
    };
}

function normalizeHeroSkill(rawSkill, fallbackId = '') {
    const parseIntField = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
    };

    return {
        id: String(rawSkill?.id || fallbackId || `skill_${Date.now()}`),
        name: rawSkill?.name ? String(rawSkill.name) : 'Habilidad',
        description: rawSkill?.description ? String(rawSkill.description) : '',
        type: rawSkill?.type ? String(rawSkill.type) : 'attack',
        dice: rawSkill?.dice ? String(rawSkill.dice) : 'd8',
        accuracy: parseIntField(rawSkill?.accuracy, 0),
        power: parseIntField(rawSkill?.power, 0),
        guardBonus: parseIntField(rawSkill?.guardBonus, 0),
        critBoost: parseIntField(rawSkill?.critBoost, 0),
        enemyAccuracyPenalty: parseIntField(rawSkill?.enemyAccuracyPenalty, 0),
        cooldown: Math.max(0, parseIntField(rawSkill?.cooldown, 0))
    };
}

function normalizeHeroEquipmentSlot(rawItem, slotKey, fallbackId) {
    if (!rawItem || typeof rawItem !== 'object') return null;
    return normalizeHeroItem(
        { ...rawItem, type: 'equipment', slot: slotKey, quantity: 1 },
        fallbackId
    );
}

function normalizeHero(rawHero) {
    const maxHpValue = Number(rawHero?.maxHp ?? rawHero?.hp);
    const safeMaxHp = Number.isFinite(maxHpValue) && maxHpValue > 0 ? maxHpValue : 1;
    const hpValue = Number(rawHero?.hp ?? safeMaxHp);
    const safeHp = Number.isFinite(hpValue) ? Math.max(0, Math.min(hpValue, safeMaxHp)) : safeMaxHp;
    const heroId = String(rawHero?.id ?? rawHero?._id ?? '');
    const heroAttack = Number(rawHero?.attack);
    const heroDefense = Number(rawHero?.defense);

    const inventory = Array.isArray(rawHero?.inventory)
        ? rawHero.inventory
            .map((item, index) => normalizeHeroItem(item, `${heroId || 'hero'}_inv_${index + 1}`))
            .filter((item) => item.quantity > 0)
            .slice(0, 80)
        : [];

    const skills = Array.isArray(rawHero?.skills)
        ? rawHero.skills
            .map((skill, index) => normalizeHeroSkill(skill, `${heroId || 'hero'}_skill_${index + 1}`))
            .slice(0, 20)
        : [];

    const sourceEquipment = rawHero?.equipment && typeof rawHero.equipment === 'object'
        ? rawHero.equipment
        : {};
    const equipment = {
        weapon: normalizeHeroEquipmentSlot(
            sourceEquipment.weapon,
            'weapon',
            `${heroId || 'hero'}_eq_weapon`
        ),
        armor: normalizeHeroEquipmentSlot(
            sourceEquipment.armor,
            'armor',
            `${heroId || 'hero'}_eq_armor`
        ),
        trinket: normalizeHeroEquipmentSlot(
            sourceEquipment.trinket,
            'trinket',
            `${heroId || 'hero'}_eq_trinket`
        )
    };

    return {
        id: heroId,
        name: rawHero?.name || 'Héroe',
        role: rawHero?.role || 'Aventurero',
        weapon: rawHero?.weapon || '',
        icon: rawHero?.icon || '⚔️',
        hp: safeHp,
        maxHp: safeMaxHp,
        attack: Number.isFinite(heroAttack) ? Math.floor(heroAttack) : 0,
        defense: Number.isFinite(heroDefense) ? Math.floor(heroDefense) : 0,
        archetype: rawHero?.archetype ? String(rawHero.archetype) : '',
        statusEffects: Array.isArray(rawHero?.statusEffects) ? rawHero.statusEffects.slice(0, 20) : [],
        inventory,
        skills,
        equipment
    };
}

function toPositiveInt(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

function normalizeDayLimit(value, fallback = DEFAULT_DAY_LIMIT_FALLBACK) {
    return Math.max(MIN_DAY_LIMIT, toPositiveInt(value, fallback));
}

function normalizeSlotIndex(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.min(ACTIONS_PER_DAY - 1, Math.floor(parsed));
}

function dayPhaseLabel(slotIndex) {
    const safeSlot = normalizeSlotIndex(slotIndex, 0);
    return DAY_PHASES[safeSlot] || DAY_PHASES[0];
}

function toBoundedNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function renderTemplate(template, variables) {
    const source = String(template || '');
    return source.replace(/\{(\w+)\}/g, (_, key) => {
        if (variables[key] === undefined || variables[key] === null) return '';
        return String(variables[key]);
    });
}

function decodeEscapedNewlines(text) {
    const source = String(text || '');
    return source
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n');
}

function normalizeInitialOptions(rawOptions) {
    const normalized = normalizeClientOptions(rawOptions);
    return normalized.length > 0 ? normalized : DEFAULT_INITIAL_OPTIONS;
}

function normalizeNarrativeSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        key: 'global',
        defaultDayLimit: normalizeDayLimit(source.defaultDayLimit, DEFAULT_NARRATIVE_SETTINGS.defaultDayLimit),
        introTemplate: decodeEscapedNewlines(typeof source.introTemplate === 'string' && source.introTemplate.trim()
            ? source.introTemplate.trim()
            : DEFAULT_NARRATIVE_SETTINGS.introTemplate),
        tutorialTemplate: decodeEscapedNewlines(typeof source.tutorialTemplate === 'string' && source.tutorialTemplate.trim()
            ? source.tutorialTemplate.trim()
            : DEFAULT_NARRATIVE_SETTINGS.tutorialTemplate),
        initialOptions: normalizeInitialOptions(source.initialOptions),
        generationConfig: {
            temperature: toBoundedNumber(
                source?.generationConfig?.temperature,
                DEFAULT_NARRATIVE_SETTINGS.generationConfig.temperature,
                0,
                2
            ),
            maxOutputTokens: Math.max(
                4096,
                Math.min(
                    8192,
                    toPositiveInt(
                        source?.generationConfig?.maxOutputTokens,
                        DEFAULT_NARRATIVE_SETTINGS.generationConfig.maxOutputTokens
                    )
                )
            )
        },
        systemPrompt: typeof source.systemPrompt === 'string' && source.systemPrompt.trim()
            ? source.systemPrompt.trim()
            : DEFAULT_NARRATIVE_SETTINGS.systemPrompt
    };
}

async function getNarrativeSettings(db, { force = false } = {}) {
    const now = Date.now();
    if (!force && narrativeSettingsCache.value && (now - narrativeSettingsCache.fetchedAt) < NARRATIVE_SETTINGS_CACHE_TTL_MS) {
        return narrativeSettingsCache.value;
    }

    const raw = await db.collection('narrative_settings').findOne({
        key: 'global',
        active: { $ne: false }
    });
    const normalized = normalizeNarrativeSettings(raw);
    narrativeSettingsCache = {
        fetchedAt: now,
        value: normalized
    };
    return normalized;
}

function buildCampaignIdQuery(campaignId) {
    const normalizedId = String(campaignId || '').trim();
    const query = [
        { id: normalizedId },
        { slug: normalizedId }
    ];

    if (ObjectId.isValid(normalizedId)) {
        query.push({ _id: new ObjectId(normalizedId) });
    }
    return query;
}

async function findCampaignByAnyId(db, campaignId) {
    const normalizedId = String(campaignId || '').trim();
    if (!normalizedId) return null;
    return db.collection('campaigns').findOne({
        $and: [
            { $or: buildCampaignIdQuery(normalizedId) },
            { active: { $ne: false } }
        ]
    });
}

function buildIntroText(campaignTitle, locationName, narrativeSettings = DEFAULT_NARRATIVE_SETTINGS) {
    return renderTemplate(decodeEscapedNewlines(narrativeSettings.introTemplate), {
        campaignTitle,
        locationName
    });
}

function buildTutorialText(dayLimit, narrativeSettings = DEFAULT_NARRATIVE_SETTINGS) {
    return renderTemplate(decodeEscapedNewlines(narrativeSettings.tutorialTemplate), {
        dayLimit,
        actionsPerDay: ACTIONS_PER_DAY
    });
}

function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'sí';
}

function buildRuntimeSystemPrompt(basePrompt, { forceCombat = false } = {}) {
    const base = String(basePrompt || '').trim() || DEFAULT_SYSTEM_PROMPT;
    const runtimeRules = [
        'Reglas obligatorias adicionales para ESTA respuesta:',
        '- Estas reglas tienen prioridad sobre cualquier instrucción previa.',
        '- <NARRATIVA> debe estar bien desarrollada, con detalle de ambiente, acción y consecuencia inmediata.',
        '- Si la respuesta queda corta, amplíala hasta que se sienta completa para el turno.',
        '- <DECISIONES> debe incluir exactamente 3 opciones accionables.',
        '- <EVENTOS> debe estar completo y con valores válidos.',
        forceCombat
            ? '- OBLIGATORIO: combate: si y tipo_combate distinto de ninguno.'
            : '- Si no hay combate, usa tipo_combate: ninguno.'
    ].join('\n');
    return `${base}\n\n${runtimeRules}`;
}

function normalizeCampaign(rawCampaign, narrativeSettings = DEFAULT_NARRATIVE_SETTINGS) {
    const id = rawCampaign?.id || rawCampaign?.slug || (rawCampaign?._id ? String(rawCampaign._id) : '');
    const title = rawCampaign?.title || 'Campaña sin título';
    const location = rawCampaign?.location || 'Ubicación desconocida';
    const dayLimit = normalizeDayLimit(rawCampaign?.dayLimit, narrativeSettings.defaultDayLimit);

    return {
        id,
        title,
        desc: rawCampaign?.desc || '',
        location,
        img: rawCampaign?.img || '',
        dayLimit,
        introText: rawCampaign?.introText || buildIntroText(title, location, narrativeSettings),
        tutorialText: buildTutorialText(dayLimit, narrativeSettings),
        heroes: Array.isArray(rawCampaign?.heroes) ? rawCampaign.heroes.map(normalizeHero) : []
    };
}

function enrichSaveState(rawSave) {
    const dayLimit = normalizeDayLimit(rawSave?.dayLimit, DEFAULT_DAY_LIMIT_FALLBACK);
    const saveDay = toPositiveInt(rawSave?.day, 1);
    const day = Math.max(1, Math.min(saveDay, dayLimit));
    const slotIndex = normalizeSlotIndex(rawSave?.slotIndex, 0);
    const slotLabel = dayPhaseLabel(slotIndex);
    const chapterStatus = rawSave?.chapterStatus === 'completed' ? 'completed' : 'active';
    const chapterEnded = chapterStatus === 'completed';

    return {
        ...rawSave,
        day,
        slotIndex,
        slotLabel,
        actionsPerDay: ACTIONS_PER_DAY,
        actionsRemainingToday: Math.max(0, ACTIONS_PER_DAY - (slotIndex + 1)),
        dayLimit,
        daysRemaining: Math.max(0, dayLimit - day),
        chapterStatus,
        chapterEnded
    };
}

function normalizeSaveSummary(rawSave) {
    const saveState = enrichSaveState(rawSave);
    const history = Array.isArray(saveState?.history) ? saveState.history : [];
    const lastEntry = history.length > 0 ? history[history.length - 1] : null;
    return {
        id: saveState?._id ? String(saveState._id) : '',
        campaignId: saveState?.campaignId || '',
        title: saveState?.campaignTitle || 'Partida sin título',
        location: saveState?.locationName || 'Desconocido',
        lastEvent: lastEntry?.content || 'Sin eventos recientes.',
        updatedAt: saveState?.updatedAt || saveState?.createdAt || null,
        img: saveState?.currentBackground || '',
        day: saveState.day,
        slotLabel: saveState.slotLabel,
        dayLimit: saveState.dayLimit,
        chapterStatus: saveState.chapterStatus
    };
}

function buildActionResponse(save, extra = {}) {
    const state = enrichSaveState(save);
    return {
        ...state,
        narratorEnabled: !state.chapterEnded,
        chapterEnded: state.chapterEnded,
        ...extra
    };
}

function normalizeRequestId(value) {
    const id = String(value || '').trim();
    return id ? id.slice(0, 96) : '';
}

function buildOptimisticTurnFilter(userObjectId, currentSave, currentTurn) {
    const base = { userId: userObjectId };
    if (currentSave?.turn === undefined || currentSave?.turn === null) {
        return {
            ...base,
            $or: [{ turn: { $exists: false } }, { turn: null }]
        };
    }
    return {
        ...base,
        turn: currentTurn
    };
}

function normalizeClientOptions(options) {
    if (!Array.isArray(options)) return [];

    const toId = (source, i) => {
        const normalized = String(source || '')
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48);
        return normalized || `opcion_${Date.now()}_${i + 1}`;
    };

    return options
        .map((rawOption, i) => {
            const label = String(rawOption?.label || '').trim();
            if (!label) return null;

            const id = toId(rawOption?.id || label, i);
            const type = rawOption?.type === 'combat' ? 'combat' : 'narrative';
            return { id, label, type };
        })
        .filter(Boolean)
        .slice(0, MAX_SYNC_OPTIONS);
}

class NarrativeController {
    static async getCampaigns(req, res) {
        try {
            const db = getDB();
            const narrativeSettings = await getNarrativeSettings(db);
            const campaigns = await db
                .collection('campaigns')
                .find({ active: { $ne: false } })
                .toArray();

            return res.json(campaigns.map((campaign) => normalizeCampaign(campaign, narrativeSettings)));
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async getCampaignById(req, res) {
        try {
            const db = getDB();
            const narrativeSettings = await getNarrativeSettings(db);
            const { campaignId } = req.params;
            if (!campaignId) {
                return res.status(400).json({ error: 'campaignId requerido' });
            }
            const campaign = await findCampaignByAnyId(db, campaignId);

            if (!campaign) {
                return res.status(404).json({ error: 'Campaña no encontrada' });
            }

            return res.json(normalizeCampaign(campaign, narrativeSettings));
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async loadProgress(req, res) {
        try {
            const db = getDB();
            const { userId } = req.params;
            if (!userId || userId === 'undefined') return res.status(400).json({ error: "ID no válido" });
            const save = await db.collection('saves').findOne({ userId: new ObjectId(userId) });
            if (!save) return res.status(404).json({ error: "No save found" });
            res.json(enrichSaveState(save));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async listSaves(req, res) {
        try {
            const db = getDB();
            const { userId } = req.params;
            if (!userId || userId === 'undefined' || !ObjectId.isValid(userId)) {
                return res.status(400).json({ error: "ID no válido" });
            }

            const saves = await db
                .collection('saves')
                .find({ userId: new ObjectId(userId) })
                .sort({ updatedAt: -1 })
                .toArray();

            return res.json(saves.map(normalizeSaveSummary));
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async deleteSave(req, res) {
        try {
            const db = getDB();
            const { userId, saveId } = req.params;

            if (!userId || !ObjectId.isValid(userId)) {
                return res.status(400).json({ error: "ID de usuario no válido" });
            }
            if (!saveId || !ObjectId.isValid(saveId)) {
                return res.status(400).json({ error: "ID de partida no válido" });
            }

            const deleteResult = await db.collection('saves').deleteOne({
                _id: new ObjectId(saveId),
                userId: new ObjectId(userId)
            });

            if (deleteResult.deletedCount === 0) {
                return res.status(404).json({ error: "Partida no encontrada" });
            }

            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async processAction(req, res) {
        try {
            const db = getDB();
            const narrativeSettings = await getNarrativeSettings(db);
            const { userId, action } = req.body;
            if (!userId || !ObjectId.isValid(userId)) {
                return res.status(400).json({ error: "ID de usuario no válido" });
            }
            const safeAction = action && typeof action === 'object' ? action : { type: 'action', label: 'Acción' };
            const userObjectId = new ObjectId(userId);

            if (safeAction.type === 'init') {
                const sessionData = safeAction.data && typeof safeAction.data === 'object' ? safeAction.data : {};
                const campaignRecord = await findCampaignByAnyId(db, sessionData.campaignId);
                const campaignData = campaignRecord
                    ? normalizeCampaign(campaignRecord, narrativeSettings)
                    : normalizeCampaign({
                        id: sessionData.campaignId,
                        title: sessionData.campaignTitle,
                        location: sessionData.location,
                        img: sessionData.currentBackground || sessionData.img,
                        dayLimit: sessionData.dayLimit
                    }, narrativeSettings);
                const dayLimit = normalizeDayLimit(campaignData.dayLimit, narrativeSettings.defaultDayLimit);
                const introText = campaignData.introText || buildIntroText(campaignData.title, campaignData.location, narrativeSettings);
                const tutorialText = campaignData.tutorialText || buildTutorialText(dayLimit, narrativeSettings);
                const initialParty = Array.isArray(sessionData.party)
                    ? sessionData.party.map(normalizeHero)
                    : [];
                const newSave = {
                    userId: userObjectId,
                    campaignId: campaignData.id || sessionData.campaignId || '',
                    campaignTitle: campaignData.title,
                    locationName: campaignData.location,
                    currentBackground: campaignData.img || sessionData.currentBackground || sessionData.img || '',
                    party: initialParty,
                    history: [
                        { type: 'narrative', content: introText },
                        { type: 'narrative', content: tutorialText },
                        { type: 'narrative', content: `Día 1 de ${dayLimit}, mañana. El capítulo comienza ahora.` }
                    ],
                    currentOptions: normalizeInitialOptions(narrativeSettings.initialOptions),
                    day: 1,
                    slotIndex: 0,
                    dayLimit,
                    chapterStatus: 'active',
                    turn: 1,
                    lastProcessedActionKey: null,
                    lastNarrationSyncKey: null,
                    updatedAt: new Date()
                };
                await db.collection('saves').updateOne({ userId: userObjectId }, { $set: newSave }, { upsert: true });
                return res.json({
                    ...enrichSaveState(newSave),
                    narratorEnabled: false,
                    chapterEnded: false
                });
            }

            const currentSave = await db.collection('saves').findOne({ userId: userObjectId });
            if (!currentSave) return res.status(404).json({ error: "Save not found" });
            const saveState = enrichSaveState(currentSave);

            if (safeAction.type === 'narration_sync') {
                const syncData = safeAction.data && typeof safeAction.data === 'object' ? safeAction.data : {};
                const syncKey = normalizeRequestId(syncData.requestId || safeAction.requestId || safeAction.actionId);
                if (!syncKey) {
                    return res.status(400).json({ error: "requestId requerido para narration_sync" });
                }

                if (currentSave.lastNarrationSyncKey === syncKey) {
                    return res.json(buildActionResponse(currentSave, { duplicate: true }));
                }

                const narrativeText = typeof syncData.narrative === 'string'
                    ? syncData.narrative.trim()
                    : '';
                const syncedOptions = normalizeClientOptions(syncData.options);
                const syncedParty = Array.isArray(syncData.party)
                    ? syncData.party.map(normalizeHero).filter(hero => hero.id || hero.name)
                    : [];
                const nextHistory = Array.isArray(currentSave.history) ? [...currentSave.history] : [];

                if (narrativeText) {
                    nextHistory.push({ type: 'narrative', content: narrativeText });
                }

                const currentTurn = toPositiveInt(currentSave.turn, 1);
                const updatePayload = {
                    history: nextHistory,
                    currentOptions: syncedOptions.length > 0
                        ? syncedOptions
                        : (Array.isArray(currentSave.currentOptions) ? currentSave.currentOptions : []),
                    lastNarrationSyncKey: syncKey,
                    turn: currentTurn + 1,
                    updatedAt: new Date()
                };
                if (syncedParty.length > 0) {
                    updatePayload.party = syncedParty;
                }

                const updateFilter = {
                    ...buildOptimisticTurnFilter(userObjectId, currentSave, currentTurn),
                    lastNarrationSyncKey: { $ne: syncKey }
                };

                const updateResult = await db.collection('saves').updateOne(updateFilter, { $set: updatePayload });
                if (updateResult.modifiedCount === 0) {
                    const latestSave = await db.collection('saves').findOne({ userId: userObjectId });
                    if (!latestSave) return res.status(404).json({ error: "Save not found" });
                    if (latestSave.lastNarrationSyncKey === syncKey) {
                        return res.json(buildActionResponse(latestSave, { duplicate: true }));
                    }
                    return res.status(409).json({
                        error: "Estado actualizado por otra acción. Reintenta sincronizar narración.",
                        retryable: true
                    });
                }

                const updatedSave = await db.collection('saves').findOne({ userId: userObjectId });
                return res.json(buildActionResponse(updatedSave));
            }

            if (safeAction.type === 'party_sync') {
                const syncData = safeAction.data && typeof safeAction.data === 'object' ? safeAction.data : {};
                const incomingParty = Array.isArray(syncData.party) ? syncData.party : [];
                if (incomingParty.length === 0) {
                    return res.status(400).json({ error: "party requerida para party_sync" });
                }

                const syncedParty = incomingParty.map(normalizeHero).filter(hero => hero.id || hero.name);
                const updateResult = await db.collection('saves').updateOne(
                    { userId: userObjectId },
                    {
                        $set: {
                            party: syncedParty,
                            updatedAt: new Date()
                        }
                    }
                );

                if (updateResult.matchedCount === 0) {
                    return res.status(404).json({ error: "Save not found" });
                }

                const updatedSave = await db.collection('saves').findOne({ userId: userObjectId });
                return res.json(buildActionResponse(updatedSave));
            }

            if (saveState.chapterEnded) {
                return res.json({
                    ...saveState,
                    narratorEnabled: false,
                    chapterEnded: true
                });
            }

            const requestId = normalizeRequestId(safeAction.requestId || safeAction.actionId || safeAction.meta?.requestId);
            if (!requestId) {
                return res.status(400).json({ error: "requestId requerido para procesar acción" });
            }

            if (currentSave.lastProcessedActionKey === requestId) {
                return res.json(buildActionResponse(currentSave, { duplicate: true }));
            }

            const actionType = safeAction.type || 'action';
            const actionLabel = safeAction.label || 'Acción';
            const history = Array.isArray(currentSave.history) ? [...currentSave.history] : [];
            history.push({ type: actionType, content: `Acción: ${actionLabel}` });

            const currentSlotIndex = normalizeSlotIndex(saveState.slotIndex, 0);
            const nextSlotCandidate = currentSlotIndex + 1;
            const dayIncrease = nextSlotCandidate >= ACTIONS_PER_DAY ? 1 : 0;
            const slotIndex = dayIncrease === 1 ? 0 : nextSlotCandidate;
            const nextDayCandidate = saveState.day + dayIncrease;
            const chapterEnded = nextDayCandidate > saveState.dayLimit;
            const day = chapterEnded ? saveState.dayLimit : nextDayCandidate;
            const finalSlotIndex = chapterEnded ? (ACTIONS_PER_DAY - 1) : slotIndex;
            const chapterStatus = chapterEnded ? 'completed' : 'active';

            if (chapterEnded) {
                history.push({
                    type: 'narrative',
                    content: `La noche del Día ${saveState.dayLimit} marca el cierre del capítulo. Se agotaron los días disponibles para esta misión.`
                });
            }

            const currentTurn = toPositiveInt(currentSave.turn, 1);
            const updatePayload = {
                history,
                day,
                slotIndex: finalSlotIndex,
                dayLimit: saveState.dayLimit,
                chapterStatus,
                turn: currentTurn + 1,
                lastProcessedActionKey: requestId,
                updatedAt: new Date()
            };
            if (chapterEnded) {
                updatePayload.currentOptions = [];
            }

            const updateFilter = {
                ...buildOptimisticTurnFilter(userObjectId, currentSave, currentTurn),
                lastProcessedActionKey: { $ne: requestId }
            };
            const updateResult = await db.collection('saves').updateOne(updateFilter, { $set: updatePayload });
            if (updateResult.modifiedCount === 0) {
                const latestSave = await db.collection('saves').findOne({ userId: userObjectId });
                if (!latestSave) return res.status(404).json({ error: "Save not found" });
                if (latestSave.lastProcessedActionKey === requestId) {
                    return res.json(buildActionResponse(latestSave, { duplicate: true }));
                }
                return res.status(409).json({
                    error: "Estado de partida cambiado por otra acción. Reintenta.",
                    retryable: true
                });
            }

            const updated = await db.collection('saves').findOne({ userId: userObjectId });
            return res.json({
                ...enrichSaveState(updated),
                narratorEnabled: !chapterEnded,
                chapterEnded
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async stream(req, res) {
        const { playerAction, storyHistory, worldSeed, forceCombat } = req.body || {};
        const apiKey = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

        const history = normalizeHistory(storyHistory);
        const mustForceCombat = toBoolean(forceCombat);
        const combatDirective = mustForceCombat
            ? '\nDirectiva de turno: forzar_combate: si.'
            : '';
        const playerPrompt = `${worldSeed ? `Contexto: ${worldSeed}\n` : ''}Acción del jugador: ${playerAction}${combatDirective}`.trim();
        history.push({ role: 'user', parts: [{ text: playerPrompt }] });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        
        try {
            if (!apiKey) {
                return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' });
            }

            const db = getDB();
            const narrativeSettings = await getNarrativeSettings(db);
            const systemPrompt = buildRuntimeSystemPrompt(narrativeSettings.systemPrompt, {
                forceCombat: mustForceCombat
            });
            const response = await fetch(`${GEMINI_API_BASE_URL}/models/${model}:streamGenerateContent?alt=sse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: history,
                    generationConfig: {
                        temperature: narrativeSettings.generationConfig.temperature,
                        maxOutputTokens: narrativeSettings.generationConfig.maxOutputTokens
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                return res.status(502).json({ error: `Gemini error ${response.status}: ${errorBody}` });
            }
            if (!response.body) {
                return res.status(502).json({ error: 'Gemini no devolvió stream' });
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
                let sep = buffer.indexOf('\n\n');
                while (sep !== -1) {
                    writeEventToResponse(buffer.slice(0, sep), res);
                    buffer = buffer.slice(sep + 2);
                    sep = buffer.indexOf('\n\n');
                }
            }

            if (buffer.trim()) {
                writeEventToResponse(buffer, res);
            }
            res.end();
        } catch (err) {
            if (!res.headersSent) res.status(500).json({ error: err.message });
            else res.end();
        }
    }
}

module.exports = NarrativeController;
