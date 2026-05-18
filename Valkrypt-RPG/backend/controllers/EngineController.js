const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const PDFDocument = require('pdfkit');

const MAX_CONTEXT_MESSAGES = 15;

function toObjectId(value) {
    const id = String(value || '').trim();
    if (!ObjectId.isValid(id)) return null;
    return new ObjectId(id);
}

function summarize(messages) {
    const compact = (messages || [])
        .map((msg) => `${msg.role}: ${String(msg.content || '').replace(/\s+/g, ' ').trim()}`)
        .join(' | ');
    return compact.slice(0, 1200);
}

function normalizeRole(role) {
    return role === 'model' ? 'model' : 'user';
}

class EngineController {
    static async getContext(req, res) {
        try {
            const sessionId = String(req.params.sessionId || '').trim();
            const userObjectId = toObjectId(req.query.userId);
            if (!sessionId || !userObjectId) {
                return res.status(400).json({ error: 'Sessió o usuari no vàlid.' });
            }

            const db = getDB();
            const doc = await db.collection('contexts').findOne({ sessionId, userId: userObjectId });

            return res.json({
                sessionId,
                messages: Array.isArray(doc?.messages) ? doc.messages : [],
                summary: doc?.summary || '',
                updatedAt: doc?.updatedAt || null,
            });
        } catch (error) {
            console.error('Error carregant context del motor:', error);
            return res.status(500).json({ error: 'Error intern del servidor.' });
        }
    }

    static async pushContext(req, res) {
        try {
            const sessionId = String(req.params.sessionId || '').trim();
            const userObjectId = toObjectId(req.body.userId);
            const role = normalizeRole(String(req.body.role || '').trim());
            const content = String(req.body.content || '').trim();

            if (!sessionId || !userObjectId || !content) {
                return res.status(400).json({ error: 'Dades de context invàlides.' });
            }

            const db = getDB();
            const contexts = db.collection('contexts');
            const current = await contexts.findOne({ sessionId, userId: userObjectId });
            const messages = Array.isArray(current?.messages) ? current.messages.slice(-(MAX_CONTEXT_MESSAGES - 1)) : [];
            messages.push({
                role,
                content: content.slice(0, 4000),
                createdAt: new Date().toISOString(),
            });

            const summary = messages.length >= MAX_CONTEXT_MESSAGES ? summarize(messages) : (current?.summary || '');

            await contexts.updateOne(
                { sessionId, userId: userObjectId },
                {
                    $set: {
                        sessionId,
                        userId: userObjectId,
                        messages,
                        summary,
                        updatedAt: new Date().toISOString(),
                    },
                },
                { upsert: true },
            );

            return res.json({ ok: true, count: messages.length, summary });
        } catch (error) {
            console.error('Error guardant context del motor:', error);
            return res.status(500).json({ error: 'Error intern del servidor.' });
        }
    }

    static async roomHistory(req, res) {
        try {
            const roomId = String(req.params.roomId || '').trim();
            if (!roomId) return res.status(400).json({ error: 'Cal roomId.' });

            const db = getDB();
            const rows = await db
                .collection('chat_messages')
                .find({ roomId })
                .sort({ createdAt: 1 })
                .limit(300)
                .toArray();

            return res.json(rows.map((row) => ({
                roomId: row.roomId,
                from: row.from,
                text: row.text,
                createdAt: row.createdAt,
            })));
        } catch (error) {
            console.error('Error carregant historial de sala:', error);
            return res.status(500).json({ error: 'Error intern del servidor.' });
        }
    }

    static async roomSend(req, res) {
        try {
            const roomId = String(req.params.roomId || '').trim();
            const from = String(req.body.from || '').trim();
            const text = String(req.body.text || '').trim();
            if (!roomId || !from || !text) {
                return res.status(400).json({ error: 'Missatge invàlid.' });
            }

            const db = getDB();
            const doc = { roomId, from, text: text.slice(0, 2000), createdAt: new Date() };
            await db.collection('chat_messages').insertOne(doc);
            return res.json({ ok: true });
        } catch (error) {
            console.error('Error enviant missatge de sala:', error);
            return res.status(500).json({ error: 'Error intern del servidor.' });
        }
    }

    static async listChronicles(req, res) {
        try {
            const userObjectId = toObjectId(req.query.userId);
            if (!userObjectId) return res.status(400).json({ error: 'Usuari no vàlid.' });

            const db = getDB();
            const save = await db.collection('saves').findOne({ userId: userObjectId });
            if (!save) return res.json([]);

            const history = Array.isArray(save.history) ? save.history : [];
            const cards = history
                .filter((entry) => entry?.content)
                .slice(-100)
                .map((entry, index) => {
                    const text = String(entry.content || '').replace(/\s+/g, ' ').trim();
                    return {
                        id: `${String(save._id)}_${index}`,
                        title: `Crònica ${index + 1}`,
                        date: save.updatedAt || save.createdAt || new Date().toISOString(),
                        summary: text.slice(0, 180),
                        type: entry.type || 'narrative',
                    };
                })
                .reverse();

            return res.json(cards);
        } catch (error) {
            console.error('Error llistant cròniques:', error);
            return res.status(500).json({ error: 'Error intern del servidor.' });
        }
    }

    static async exportChroniclesPdf(req, res) {
        try {
            const userObjectId = toObjectId(req.query.userId);
            if (!userObjectId) return res.status(400).json({ error: 'Usuari no vàlid.' });

            const db = getDB();
            const save = await db.collection('saves').findOne({ userId: userObjectId });
            if (!save) return res.status(404).json({ error: 'No hi ha cròniques per exportar.' });

            const history = Array.isArray(save.history) ? save.history : [];
            const lines = history
                .filter((entry) => entry?.content)
                .slice(-200)
                .map((entry, index) => {
                    const title = `Crònica ${index + 1}`;
                    const body = String(entry.content || '').replace(/\s+/g, ' ').trim();
                    return { title, body, type: entry.type || 'narrative' };
                });

            const dateLabel = new Date().toISOString().slice(0, 10);
            const filename = `valkrypt-croniques-${dateLabel}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            doc.pipe(res);

            doc.fontSize(20).text('Valkrypt - Historial de Cròniques', { underline: true });
            doc.moveDown(0.4);
            doc.fontSize(10).text(`Exportat: ${new Date().toLocaleString('ca-ES')}`);
            doc.moveDown(0.8);

            if (!lines.length) {
                doc.fontSize(12).text('No hi ha entrades de crònica per exportar.');
            } else {
                lines.forEach((row, idx) => {
                    doc.fontSize(13).text(`${idx + 1}. ${row.title} [${row.type}]`);
                    doc.moveDown(0.2);
                    doc.fontSize(11).text(row.body || '(sense contingut)', { align: 'left' });
                    doc.moveDown(0.8);
                });
            }

            doc.end();
        } catch (error) {
            console.error('Error exportant cròniques PDF:', error);
            return res.status(500).json({ error: 'No s\'ha pogut generar el PDF.' });
        }
    }
}

module.exports = EngineController;
