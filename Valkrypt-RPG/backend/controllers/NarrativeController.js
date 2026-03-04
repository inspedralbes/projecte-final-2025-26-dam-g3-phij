const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_HISTORY_ITEMS = 14;
const DEFAULT_DAY_LIMIT_FALLBACK = 7;
const MAX_CLIENT_NARRATIVE_CHARS = 9000;
const MAX_SYNC_OPTIONS = 6;
const NARRATIVE_SETTINGS_CACHE_TTL_MS = 30000;

const DEFAULT_SYSTEM_PROMPT = `Eres el narrador principal de "Valkrypt", un RPG de fantasía oscura.
Reglas globales:
- Responde siempre en español.
- Mantén un tono inmersivo, tenso y cinematográfico.
- Integra la acción del jugador de forma coherente con el contexto previo.
- Avanza la trama con consecuencias claras.
- Escribe la narrativa en 1 a 3 párrafos breves.
- Si la acción del jugador es violenta, imprudente o desafiante, prioriza eventos de combate.
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
    tutorialTemplate: 'TUTORIAL DE CAMPAÑA:\n1) Cada acción consume tiempo y avanza el calendario.\n2) Vigila el estado del grupo y el contexto antes de decidir.\n3) La campaña termina cuando se agotan los días del capítulo.\n4) Te quedan {dayLimit} días para resolver esta misión principal.',
    initialOptions: DEFAULT_INITIAL_OPTIONS,
    generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 65535
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

function normalizeHero(rawHero) {
    const maxHpValue = Number(rawHero?.maxHp ?? rawHero?.hp);
    const safeMaxHp = Number.isFinite(maxHpValue) && maxHpValue > 0 ? maxHpValue : 1;
    const hpValue = Number(rawHero?.hp ?? safeMaxHp);
    const safeHp = Number.isFinite(hpValue) ? Math.max(0, Math.min(hpValue, safeMaxHp)) : safeMaxHp;

    return {
        id: String(rawHero?.id ?? rawHero?._id ?? ''),
        name: rawHero?.name || 'Héroe',
        role: rawHero?.role || 'Aventurero',
        weapon: rawHero?.weapon || '',
        icon: rawHero?.icon || '⚔️',
        hp: safeHp,
        maxHp: safeMaxHp
    };
}

function toPositiveInt(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
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

function normalizeInitialOptions(rawOptions) {
    const normalized = normalizeClientOptions(rawOptions);
    return normalized.length > 0 ? normalized : DEFAULT_INITIAL_OPTIONS;
}

function normalizeNarrativeSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        key: 'global',
        defaultDayLimit: toPositiveInt(source.defaultDayLimit, DEFAULT_NARRATIVE_SETTINGS.defaultDayLimit),
        introTemplate: typeof source.introTemplate === 'string' && source.introTemplate.trim()
            ? source.introTemplate.trim()
            : DEFAULT_NARRATIVE_SETTINGS.introTemplate,
        tutorialTemplate: typeof source.tutorialTemplate === 'string' && source.tutorialTemplate.trim()
            ? source.tutorialTemplate.trim()
            : DEFAULT_NARRATIVE_SETTINGS.tutorialTemplate,
        initialOptions: normalizeInitialOptions(source.initialOptions),
        generationConfig: {
            temperature: toBoundedNumber(
                source?.generationConfig?.temperature,
                DEFAULT_NARRATIVE_SETTINGS.generationConfig.temperature,
                0,
                2
            ),
            maxOutputTokens: toPositiveInt(
                source?.generationConfig?.maxOutputTokens,
                DEFAULT_NARRATIVE_SETTINGS.generationConfig.maxOutputTokens
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
    return renderTemplate(narrativeSettings.introTemplate, {
        campaignTitle,
        locationName
    });
}

function buildTutorialText(dayLimit, narrativeSettings = DEFAULT_NARRATIVE_SETTINGS) {
    return renderTemplate(narrativeSettings.tutorialTemplate, {
        dayLimit
    });
}

function normalizeCampaign(rawCampaign, narrativeSettings = DEFAULT_NARRATIVE_SETTINGS) {
    const id = rawCampaign?.id || rawCampaign?.slug || (rawCampaign?._id ? String(rawCampaign._id) : '');
    const title = rawCampaign?.title || 'Campaña sin título';
    const location = rawCampaign?.location || 'Ubicación desconocida';
    const dayLimit = toPositiveInt(rawCampaign?.dayLimit, narrativeSettings.defaultDayLimit);

    return {
        id,
        title,
        desc: rawCampaign?.desc || '',
        location,
        img: rawCampaign?.img || '',
        dayLimit,
        introText: rawCampaign?.introText || buildIntroText(title, location, narrativeSettings),
        tutorialText: rawCampaign?.tutorialText || buildTutorialText(dayLimit, narrativeSettings),
        heroes: Array.isArray(rawCampaign?.heroes) ? rawCampaign.heroes.map(normalizeHero) : []
    };
}

function enrichSaveState(rawSave) {
    const dayLimit = toPositiveInt(rawSave?.dayLimit, DEFAULT_DAY_LIMIT_FALLBACK);
    const saveDay = toPositiveInt(rawSave?.day, 1);
    const day = Math.max(1, Math.min(saveDay, dayLimit));
    const chapterStatus = rawSave?.chapterStatus === 'completed' ? 'completed' : 'active';
    const chapterEnded = chapterStatus === 'completed';

    return {
        ...rawSave,
        day,
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
                const dayLimit = toPositiveInt(campaignData.dayLimit, narrativeSettings.defaultDayLimit);
                const introText = campaignData.introText || buildIntroText(campaignData.title, campaignData.location, narrativeSettings);
                const tutorialText = campaignData.tutorialText || buildTutorialText(dayLimit, narrativeSettings);
                const newSave = {
                    userId: userObjectId,
                    campaignId: campaignData.id || sessionData.campaignId || '',
                    campaignTitle: campaignData.title,
                    locationName: campaignData.location,
                    currentBackground: campaignData.img || sessionData.currentBackground || sessionData.img || '',
                    party: Array.isArray(sessionData.party) ? sessionData.party : [],
                    history: [
                        { type: 'narrative', content: introText },
                        { type: 'narrative', content: tutorialText },
                        { type: 'narrative', content: `Día 1 de ${dayLimit}. El capítulo comienza ahora.` }
                    ],
                    currentOptions: normalizeInitialOptions(narrativeSettings.initialOptions),
                    day: 1,
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
                    ? syncData.narrative.trim().slice(0, MAX_CLIENT_NARRATIVE_CHARS)
                    : '';
                const syncedOptions = normalizeClientOptions(syncData.options);
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

            const nextDayCandidate = saveState.day + 1;
            const chapterEnded = nextDayCandidate > saveState.dayLimit;
            const day = chapterEnded ? saveState.dayLimit : nextDayCandidate;
            const chapterStatus = chapterEnded ? 'completed' : 'active';

            if (chapterEnded) {
                history.push({
                    type: 'narrative',
                    content: `El Día ${saveState.dayLimit} se cierra y concluye este capítulo de la campaña. El grupo ha alcanzado el límite de tiempo para esta misión.`
                });
            }

            const currentTurn = toPositiveInt(currentSave.turn, 1);
            const updatePayload = {
                history,
                day,
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
        const { playerAction, storyHistory, worldSeed } = req.body || {};
        const apiKey = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

        const history = normalizeHistory(storyHistory);
        const playerPrompt = `${worldSeed ? `Contexto: ${worldSeed}\n` : ''}Acción del jugador: ${playerAction}`.trim();
        history.push({ role: 'user', parts: [{ text: playerPrompt }] });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        
        try {
            if (!apiKey) {
                return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' });
            }

            const db = getDB();
            const narrativeSettings = await getNarrativeSettings(db);
            const response = await fetch(`${GEMINI_API_BASE_URL}/models/${model}:streamGenerateContent?alt=sse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: narrativeSettings.systemPrompt }] },
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
