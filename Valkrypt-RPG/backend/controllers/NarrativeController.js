const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_HISTORY_ITEMS = 14;
const MAX_OUTPUT_TOKENS = 65535;
const DEFAULT_DAY_LIMIT = 7;

const SYSTEM_PROMPT = `Eres el narrador principal de "Valkrypt", un RPG de fantasía oscura.
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

function buildIntroText(campaignTitle, locationName) {
    return `La crónica "${campaignTitle}" comienza en ${locationName}. Las decisiones del grupo moldearán el destino del reino. Nadie conoce aún la magnitud de lo que aguarda bajo la piedra.`;
}

function buildTutorialText(dayLimit) {
    return `TUTORIAL DE CAMPAÑA:\n1) Cada acción consume tiempo y avanza el calendario.\n2) Vigila el estado del grupo y el contexto antes de decidir.\n3) La campaña termina cuando se agotan los días del capítulo.\n4) Te quedan ${dayLimit} días para resolver esta misión principal.`;
}

function normalizeCampaign(rawCampaign) {
    const id = rawCampaign?.id || rawCampaign?.slug || (rawCampaign?._id ? String(rawCampaign._id) : '');
    const title = rawCampaign?.title || 'Campaña sin título';
    const location = rawCampaign?.location || 'Ubicación desconocida';
    const dayLimit = toPositiveInt(rawCampaign?.dayLimit, DEFAULT_DAY_LIMIT);

    return {
        id,
        title,
        desc: rawCampaign?.desc || '',
        location,
        img: rawCampaign?.img || '',
        dayLimit,
        introText: rawCampaign?.introText || buildIntroText(title, location),
        tutorialText: rawCampaign?.tutorialText || buildTutorialText(dayLimit),
        heroes: Array.isArray(rawCampaign?.heroes) ? rawCampaign.heroes.map(normalizeHero) : []
    };
}

function enrichSaveState(rawSave) {
    const dayLimit = toPositiveInt(rawSave?.dayLimit, DEFAULT_DAY_LIMIT);
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

class NarrativeController {
    static async getCampaigns(req, res) {
        try {
            const db = getDB();
            const campaigns = await db
                .collection('campaigns')
                .find({ active: { $ne: false } })
                .toArray();

            return res.json(campaigns.map(normalizeCampaign));
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    static async getCampaignById(req, res) {
        try {
            const db = getDB();
            const { campaignId } = req.params;
            if (!campaignId) {
                return res.status(400).json({ error: 'campaignId requerido' });
            }
            const campaign = await findCampaignByAnyId(db, campaignId);

            if (!campaign) {
                return res.status(404).json({ error: 'Campaña no encontrada' });
            }

            return res.json(normalizeCampaign(campaign));
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

    static async processAction(req, res) {
        try {
            const db = getDB();
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
                    ? normalizeCampaign(campaignRecord)
                    : normalizeCampaign({
                        id: sessionData.campaignId,
                        title: sessionData.campaignTitle,
                        location: sessionData.location,
                        img: sessionData.currentBackground || sessionData.img,
                        dayLimit: sessionData.dayLimit
                    });
                const dayLimit = toPositiveInt(campaignData.dayLimit, DEFAULT_DAY_LIMIT);
                const introText = campaignData.introText || buildIntroText(campaignData.title, campaignData.location);
                const tutorialText = campaignData.tutorialText || buildTutorialText(dayLimit);
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
                    currentOptions: [
                        { id: 'explorar', label: 'Explorar la zona', type: 'narrative' },
                        { id: 'avanzar', label: 'Avanzar por el sendero', type: 'narrative' },
                        { id: 'revisar_equipo', label: 'Revisar equipo y recursos', type: 'narrative' }
                    ],
                    day: 1,
                    dayLimit,
                    chapterStatus: 'active',
                    turn: 1,
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
            if (saveState.chapterEnded) {
                return res.json({
                    ...saveState,
                    narratorEnabled: false,
                    chapterEnded: true
                });
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

            const updatePayload = {
                history,
                day,
                dayLimit: saveState.dayLimit,
                chapterStatus,
                turn: toPositiveInt(currentSave.turn, 1) + 1,
                updatedAt: new Date()
            };
            if (chapterEnded) {
                updatePayload.currentOptions = [];
            }

            await db.collection('saves').updateOne({ userId: userObjectId }, { $set: updatePayload });

            const updated = await db.collection('saves').findOne({ userId: userObjectId });
            res.json({
                ...enrichSaveState(updated),
                narratorEnabled: !chapterEnded,
                chapterEnded
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async stream(req, res) {
        const { playerAction, storyHistory, worldSeed, gameState } = req.body || {};
        const apiKey = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

        const history = normalizeHistory(storyHistory);
        const playerPrompt = `${worldSeed ? `Contexto: ${worldSeed}\n` : ''}Acción del jugador: ${playerAction}`.trim();
        history.push({ role: 'user', parts: [{ text: playerPrompt }] });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        
        try {
            const response = await fetch(`${GEMINI_API_BASE_URL}/models/${model}:streamGenerateContent?alt=sse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    contents: history,
                    generationConfig: { temperature: 0.9, maxOutputTokens: MAX_OUTPUT_TOKENS }
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
