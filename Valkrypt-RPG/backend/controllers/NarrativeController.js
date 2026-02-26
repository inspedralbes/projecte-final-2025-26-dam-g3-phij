const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_HISTORY_ITEMS = 14;

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

function normalizeCampaign(rawCampaign) {
    const id = rawCampaign?.id || rawCampaign?.slug || (rawCampaign?._id ? String(rawCampaign._id) : '');
    return {
        id,
        title: rawCampaign?.title || 'Campaña sin título',
        desc: rawCampaign?.desc || '',
        location: rawCampaign?.location || 'Ubicación desconocida',
        img: rawCampaign?.img || '',
        heroes: Array.isArray(rawCampaign?.heroes) ? rawCampaign.heroes.map(normalizeHero) : []
    };
}

function normalizeSaveSummary(rawSave) {
    const history = Array.isArray(rawSave?.history) ? rawSave.history : [];
    const lastEntry = history.length > 0 ? history[history.length - 1] : null;
    return {
        id: rawSave?._id ? String(rawSave._id) : '',
        campaignId: rawSave?.campaignId || '',
        title: rawSave?.campaignTitle || 'Partida sin título',
        location: rawSave?.locationName || 'Desconocido',
        lastEvent: lastEntry?.content || 'Sin eventos recientes.',
        updatedAt: rawSave?.updatedAt || rawSave?.createdAt || null,
        img: rawSave?.currentBackground || ''
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

            const query = [
                { id: campaignId },
                { slug: campaignId }
            ];

            if (ObjectId.isValid(campaignId)) {
                query.push({ _id: new ObjectId(campaignId) });
            }

            const campaign = await db.collection('campaigns').findOne({
                $and: [
                    { $or: query },
                    { active: { $ne: false } }
                ]
            });

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
            res.json(save);
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

            if (action.type === 'init') {
                const newSave = {
                    userId: new ObjectId(userId),
                    campaignId: action.data.campaignId || '',
                    campaignTitle: action.data.campaignTitle,
                    locationName: action.data.location,
                    currentBackground: action.data.currentBackground || action.data.img || '',
                    party: action.data.party,
                    history: [{ type: 'narrative', content: `El grupo compuesto por ${action.data.party.map(p => p.name).join(', ')} comienza su viaje en ${action.data.location}.` }],
                    currentOptions: [
                        { id: 'explorar', label: 'Explorar la zona', type: 'narrative' },
                        { id: 'avanzar', label: 'Avanzar por el sendero', type: 'narrative' }
                    ],
                    turn: 1,
                    updatedAt: new Date()
                };
                await db.collection('saves').updateOne({ userId: new ObjectId(userId) }, { $set: newSave }, { upsert: true });
                return res.json(newSave);
            }

            const currentSave = await db.collection('saves').findOne({ userId: new ObjectId(userId) });
            if (!currentSave) return res.status(404).json({ error: "Save not found" });

            await db.collection('saves').updateOne(
                { userId: new ObjectId(userId) },
                { 
                    $push: { history: { type: action.type, content: `Acción: ${action.label}` } },
                    $set: { updatedAt: new Date() },
                    $inc: { turn: 1 }
                }
            );

            const updated = await db.collection('saves').findOne({ userId: new ObjectId(userId) });
            res.json(updated);
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
                    generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
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
