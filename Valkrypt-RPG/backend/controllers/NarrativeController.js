const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_HISTORY_ITEMS = 14;

const SYSTEM_PROMPT = `
Eres el narrador principal de "Valkrypt", un RPG de fantasía oscura.
Reglas:
- Responde siempre en español.
- Mantén tono inmersivo, tenso y cinematográfico.
- Integra la acción del jugador de forma coherente con el contexto previo.
- Avanza la trama con consecuencias claras, sin romper el flujo.
- Escribe entre 1 y 3 párrafos breves.
- Al final ofrece exactamente 3 opciones numeradas para la siguiente acción del jugador.
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

function extractTextFromEvent(eventPayload) {
    const candidates = eventPayload?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) return '';

    const parts = candidates[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';

    return parts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('');
}

function writeEventToResponse(rawEvent, res) {
    if (!rawEvent || !rawEvent.trim()) return;

    const lines = rawEvent.split('\n');
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith('data:')) continue;

        const eventData = trimmedLine.slice(5).trim();
        if (!eventData || eventData === '[DONE]') continue;

        try {
            const payload = JSON.parse(eventData);
            const textChunk = extractTextFromEvent(payload);
            if (textChunk) {
                res.write(textChunk);
            }
        } catch (parseError) {
            console.warn('No se pudo parsear un chunk SSE de Gemini:', parseError.message);
        }
    }
}

class NarrativeController {
    static async stream(req, res) {
        const { playerAction, storyHistory, worldSeed } = req.body || {};

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en el backend.' });
        }

        if (typeof playerAction !== 'string' || !playerAction.trim()) {
            return res.status(400).json({ error: 'Debes enviar una acción del jugador válida.' });
        }

        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const history = normalizeHistory(storyHistory);

        const playerPrompt = `
${typeof worldSeed === 'string' && worldSeed.trim() ? `Contexto del mundo:\n${worldSeed.trim()}\n` : ''}
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
                maxOutputTokens: 700,
            },
        };

        const abortController = new AbortController();
        req.on('close', () => abortController.abort());

        try {
            const geminiResponse = await fetch(
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

            if (!geminiResponse.ok) {
                const errorBody = await geminiResponse.text();
                console.error('Gemini devolvió error:', geminiResponse.status, errorBody);
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

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');

                let eventSeparatorIndex = buffer.indexOf('\n\n');
                while (eventSeparatorIndex !== -1) {
                    const rawEvent = buffer.slice(0, eventSeparatorIndex);
                    buffer = buffer.slice(eventSeparatorIndex + 2);
                    writeEventToResponse(rawEvent, res);
                    eventSeparatorIndex = buffer.indexOf('\n\n');
                }
            }

            if (buffer.trim()) {
                writeEventToResponse(buffer, res);
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
