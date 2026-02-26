const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_HISTORY_ITEMS = 14;
const MAX_PARTY_ITEMS = 6;

const SYSTEM_PROMPT = `
Eres el narrador principal de "Valkrypt", un RPG de fantasía oscura.
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
</EVENTOS>
`.trim();

function normalizeHistory(storyHistory) {
    if (!Array.isArray(storyHistory)) return [];

    return storyHistory
        .filter((item) => item && typeof item.text === 'string' && item.text.trim())
        .slice(-MAX_HISTORY_ITEMS)
        .map((item) => ({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: item.text.trim().slice(0, 2200) }],
        }));
}

function buildModelCandidates(configuredModel) {
    const preferred = typeof configuredModel === 'string' ? configuredModel.trim() : '';
    const candidates = [
        preferred,
        'gemini-2.5-flash',
        'gemini-2.0-flash',
    ].filter(Boolean);

    return [...new Set(candidates)];
}

function sanitizeNumber(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return value;
}

function normalizeGameState(rawGameState) {
    if (!rawGameState || typeof rawGameState !== 'object') return null;

    const turn = sanitizeNumber(Number(rawGameState.turn), 1);
    const partyRaw = Array.isArray(rawGameState.party) ? rawGameState.party : [];
    const party = partyRaw.slice(0, MAX_PARTY_ITEMS).map((member) => ({
        id: typeof member?.id === 'string' ? member.id.slice(0, 40) : 'desconocido',
        name: typeof member?.name === 'string' ? member.name.slice(0, 60) : 'Sin nombre',
        role: typeof member?.role === 'string' ? member.role.slice(0, 60) : 'Aventurero',
        hp: sanitizeNumber(Number(member?.hp), 0),
        maxHp: Math.max(1, sanitizeNumber(Number(member?.maxHp), 1)),
        mana: Math.max(0, sanitizeNumber(Number(member?.mana), 0)),
        maxMana: Math.max(0, sanitizeNumber(Number(member?.maxMana), 0)),
        isMage: Boolean(member?.isMage),
    }));

    const recentDecisionsRaw = Array.isArray(rawGameState.recentDecisions) ? rawGameState.recentDecisions : [];
    const recentDecisions = recentDecisionsRaw
        .slice(-8)
        .map((decision) => (typeof decision === 'string' ? decision.trim().slice(0, 150) : ''))
        .filter(Boolean);

    const combatRaw = rawGameState.combat && typeof rawGameState.combat === 'object' ? rawGameState.combat : null;
    const combat = combatRaw
        ? {
            active: Boolean(combatRaw.active),
            enemyName: typeof combatRaw.enemyName === 'string' ? combatRaw.enemyName.slice(0, 80) : 'Enemigo desconocido',
            enemyType: typeof combatRaw.enemyType === 'string' ? combatRaw.enemyType.slice(0, 20) : 'escaramuza',
            enemyHp: sanitizeNumber(Number(combatRaw.enemyHp), 0),
            enemyMaxHp: Math.max(1, sanitizeNumber(Number(combatRaw.enemyMaxHp), 1)),
        }
        : null;

    return {
        turn,
        campaignTitle: typeof rawGameState.campaignTitle === 'string' ? rawGameState.campaignTitle.slice(0, 120) : '',
        location: typeof rawGameState.location === 'string' ? rawGameState.location.slice(0, 120) : '',
        party,
        recentDecisions,
        combat,
    };
}

function summarizeGameState(gameState) {
    if (!gameState) return '';

    const partySummary = gameState.party.length
        ? gameState.party
            .map((member) => {
                const resource = member.maxMana > 0 ? `, mana ${member.mana}/${member.maxMana}` : '';
                const mageTag = member.isMage ? ', arcano' : '';
                return `${member.name} (${member.role}): HP ${member.hp}/${member.maxHp}${resource}${mageTag}`;
            })
            .join('\n- ')
        : 'Sin grupo disponible';

    const decisionsSummary = gameState.recentDecisions.length
        ? gameState.recentDecisions.map((item) => `- ${item}`).join('\n')
        : '- Sin decisiones recientes';

    const combatSummary = gameState.combat?.active
        ? `Combate activo contra ${gameState.combat.enemyName} (${gameState.combat.enemyType}) con HP ${gameState.combat.enemyHp}/${gameState.combat.enemyMaxHp}`
        : 'No hay combate activo';

    return `
Estado actual de partida:
- Turno: ${gameState.turn}
- Campaña: ${gameState.campaignTitle || 'No definida'}
- Ubicación: ${gameState.location || 'No definida'}
- Grupo:
- ${partySummary}
- Combate: ${combatSummary}
- Decisiones recientes:
${decisionsSummary}
`.trim();
}

function extractTextFromEvent(eventPayload) {
    const chunks = [];

    const candidates = eventPayload?.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
        const parts = candidates[0]?.content?.parts;
        if (Array.isArray(parts)) {
            for (const part of parts) {
                if (typeof part?.text === 'string' && part.text.trim()) {
                    chunks.push(part.text);
                }
            }
        }
    }

    // Compatibilidad con variantes donde el texto viene en serverContent/modelTurn.
    const altParts = eventPayload?.serverContent?.modelTurn?.parts;
    if (Array.isArray(altParts)) {
        for (const part of altParts) {
            if (typeof part?.text === 'string' && part.text.trim()) {
                chunks.push(part.text);
            }
        }
    }

    return chunks.join('');
}

function writeEventToResponse(rawEvent, res) {
    if (!rawEvent || !rawEvent.trim()) return 0;

    const lines = rawEvent.split('\n');
    const eventData = lines
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
        .trim();

    if (!eventData || eventData === '[DONE]') return 0;

    try {
        const payload = JSON.parse(eventData);
        const textChunk = extractTextFromEvent(payload);
        if (textChunk) {
            res.write(textChunk);
            return textChunk.length;
        }
    } catch (parseError) {
        console.warn('No se pudo parsear un chunk SSE de Gemini:', parseError.message);
    }

    return 0;
}

async function generateFallbackText(modelName, requestPayload, apiKey, signal) {
    const fallbackResponse = await fetch(
        `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(modelName)}:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(requestPayload),
            signal,
        }
    );

    if (!fallbackResponse.ok) {
        const errorBody = await fallbackResponse.text();
        throw new Error(`Fallback generateContent falló (${fallbackResponse.status}): ${errorBody}`);
    }

    const payload = await fallbackResponse.json();
    return extractTextFromEvent(payload);
}

class NarrativeController {
    static async stream(req, res) {
        const { playerAction, storyHistory, worldSeed, gameState } = req.body || {};

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en el backend.' });
        }

        if (typeof playerAction !== 'string' || !playerAction.trim()) {
            return res.status(400).json({ error: 'Debes enviar una acción del jugador válida.' });
        }

        const configuredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const modelCandidates = buildModelCandidates(configuredModel);
        const history = normalizeHistory(storyHistory);
        const normalizedGameState = normalizeGameState(gameState);
        const gameStateSummary = summarizeGameState(normalizedGameState);

        const playerPrompt = `
${typeof worldSeed === 'string' && worldSeed.trim() ? `Contexto del mundo:\n${worldSeed.trim()}\n` : ''}
${gameStateSummary ? `Contexto mecánico:\n${gameStateSummary}\n` : ''}
Acción del jugador:
${playerAction.trim()}
`.trim();

        history.push({
            role: 'user',
            parts: [{ text: playerPrompt }],
        });

        const requestPayload = {
            systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: history,
            generationConfig: {
                temperature: 0.9,
                topP: 0.95,
                maxOutputTokens: 900,
            },
        };

        const abortController = new AbortController();
        req.on('close', () => abortController.abort());

        try {
            let geminiResponse = null;
            let selectedModel = '';
            let lastErrorBody = '';
            let lastStatus = 0;

            for (const modelName of modelCandidates) {
                const response = await fetch(
                    `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(modelName)}:streamGenerateContent?alt=sse`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': process.env.GEMINI_API_KEY,
                        },
                        body: JSON.stringify(requestPayload),
                        signal: abortController.signal,
                    }
                );

                if (response.ok) {
                    geminiResponse = response;
                    selectedModel = modelName;
                    break;
                }

                lastStatus = response.status;
                lastErrorBody = await response.text();
                console.warn(
                    `Gemini stream falló con modelo "${modelName}" (${response.status}). Probando siguiente modelo...`
                );
            }

            if (!geminiResponse || !geminiResponse.ok) {
                console.error('Gemini devolvió error en todos los modelos probados:', lastStatus, lastErrorBody);
                return res.status(502).json({ error: 'No se pudo generar narrativa con Gemini.' });
            }

            if (!geminiResponse.body) {
                return res.status(502).json({ error: 'Gemini no devolvió stream de datos.' });
            }

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            if (typeof res.flushHeaders === 'function') res.flushHeaders();

            const reader = geminiResponse.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let writtenChars = 0;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');

                let eventSeparatorIndex = buffer.indexOf('\n\n');
                while (eventSeparatorIndex !== -1) {
                    const rawEvent = buffer.slice(0, eventSeparatorIndex);
                    buffer = buffer.slice(eventSeparatorIndex + 2);
                    writtenChars += writeEventToResponse(rawEvent, res);
                    eventSeparatorIndex = buffer.indexOf('\n\n');
                }
            }

            if (buffer.trim()) {
                writtenChars += writeEventToResponse(buffer, res);
            }

            // Si el stream no trajo texto legible, intentamos generateContent normal.
            if (writtenChars === 0) {
                try {
                    const fallbackText = await generateFallbackText(
                        selectedModel || modelCandidates[0],
                        requestPayload,
                        process.env.GEMINI_API_KEY,
                        abortController.signal
                    );

                    if (typeof fallbackText === 'string' && fallbackText.trim()) {
                        res.write(fallbackText);
                        writtenChars += fallbackText.length;
                    }
                } catch (fallbackError) {
                    console.error('Fallback de narrativa falló:', fallbackError.message);
                }
            }

            // Garantiza que frontend siempre recibe algo parseable.
            if (writtenChars === 0) {
                res.write(`
<NARRATIVA>
La bruma arcana distorsiona la escena y el vínculo con el oráculo se debilita. Aun así, el grupo mantiene la formación y espera tu próxima orden.
</NARRATIVA>
<DECISIONES>
1) [id:inspeccionar_ruinas] Inspeccionar las ruinas cercanas en busca de señales.
2) [id:interrogar_superviviente] Interrogar al único superviviente de la zona.
3) [id:fortificar_posicion] Fortificar la posición y preparar una emboscada.
</DECISIONES>
<EVENTOS>
combate: no
tipo_combate: ninguno
enemigo: ninguno
entorno: ruinas sombrías
tono: tensión creciente
</EVENTOS>
`.trim());
            }

            return res.end();
        } catch (error) {
            if (error.name === 'AbortError') {
                if (!res.writableEnded) res.end();
                return;
            }

            console.error('Error en stream de narrativa:', error);
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Error interno al generar narrativa.' });
            }

            if (!res.writableEnded) {
                res.write('\nEl eco del narrador se desvanece. Intenta una nueva acción.');
                res.end();
            }
        }
    }
}

module.exports = NarrativeController;
