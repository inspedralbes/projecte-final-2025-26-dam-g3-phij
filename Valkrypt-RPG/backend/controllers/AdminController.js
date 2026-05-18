const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

const DEFAULT_AI_SETTINGS = {
    key: 'global',
    active: true,
    generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 4096
    },
    model: 'gemini-2.0-flash',
    systemPrompt: 'Ets el narrador principal de Valkrypt. Mantén coherència, context i to immersiu.',
    updatedAt: new Date(),
    updatedBy: 'system'
};

const MAX_ITEM_NAME = 80;
const MAX_ITEM_DESC = 320;
const MAX_ITEM_ICON = 500;

const safeText = (value, max, fallback = '') => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, max) : fallback;
};

const toPositiveInt = (value, fallback = 1) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
};

const isValidObjectId = (value) => ObjectId.isValid(String(value || '').trim());

async function writeAdminLog(action, payload = {}) {
    const db = getDB();
    await db.collection('admin_logs').insertOne({
        action,
        payload,
        createdAt: new Date(),
    });
}

class AdminController {
    static async getAiSettings(req, res) {
        try {
            const db = getDB();
            const settings = await db.collection('narrative_settings').findOne({ key: 'global' });
            return res.json({
                success: true,
                settings: settings || DEFAULT_AI_SETTINGS
            });
        } catch (error) {
            console.error('Error carregant settings IA:', error);
            return res.status(500).json({ success: false, error: 'No s\'han pogut carregar els settings.' });
        }
    }

    static async updateAiSettings(req, res) {
        try {
            const temperature = Number(req.body?.temperature);
            const model = safeText(req.body?.model, 100, DEFAULT_AI_SETTINGS.model);
            const systemPrompt = safeText(req.body?.systemPrompt, 6000, DEFAULT_AI_SETTINGS.systemPrompt);
            const updatedBy = safeText(req.body?.updatedBy, 60, 'admin');
            const safeTemperature = Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : 0.75;

            const db = getDB();
            await db.collection('narrative_settings').updateOne(
                { key: 'global' },
                {
                    $set: {
                        key: 'global',
                        active: true,
                        model,
                        systemPrompt,
                        generationConfig: {
                            temperature: safeTemperature,
                            maxOutputTokens: 4096
                        },
                        updatedAt: new Date(),
                        updatedBy
                    }
                },
                { upsert: true }
            );

            await writeAdminLog('ai_settings_updated', { updatedBy, model, temperature: safeTemperature });
            return res.json({ success: true });
        } catch (error) {
            console.error('Error actualitzant settings IA:', error);
            return res.status(500).json({ success: false, error: 'No s\'han pogut desar els settings.' });
        }
    }

    static async testAiSettings(req, res) {
        try {
            const db = getDB();
            const settings = await db.collection('narrative_settings').findOne({ key: 'global' });
            return res.json({
                success: true,
                test: {
                    ok: true,
                    model: settings?.model || DEFAULT_AI_SETTINGS.model,
                    temperature: settings?.generationConfig?.temperature ?? DEFAULT_AI_SETTINGS.generationConfig.temperature,
                    testedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error test settings IA:', error);
            return res.status(500).json({ success: false, error: 'No s\'ha pogut provar la configuració.' });
        }
    }

    static async listInventory(req, res) {
        try {
            const page = Math.max(1, Number(req.query.page || 1));
            const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
            const search = safeText(req.query.search, 80, '');
            const filter = search ? { nameLower: { $regex: search.toLowerCase(), $options: 'i' } } : {};

            const db = getDB();
            const collection = db.collection('inventory_items');
            const [items, total] = await Promise.all([
                collection.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
                collection.countDocuments(filter)
            ]);

            return res.json({
                success: true,
                page,
                pageSize,
                total,
                items: items.map((item) => ({
                    id: String(item._id),
                    name: item.name,
                    type: item.type,
                    rarity: item.rarity,
                    quantity: item.quantity,
                    icon: item.icon || '',
                    description: item.description || '',
                    updatedAt: item.updatedAt || item.createdAt || null
                }))
            });
        } catch (error) {
            console.error('Error llistant inventari admin:', error);
            return res.status(500).json({ success: false, error: 'No s\'ha pogut carregar l\'inventari.' });
        }
    }

    static async createInventoryItem(req, res) {
        try {
            const name = safeText(req.body?.name, MAX_ITEM_NAME);
            if (!name) return res.status(400).json({ success: false, error: 'El nom és obligatori.' });

            const type = safeText(req.body?.type, 20, 'consumable');
            const rarity = safeText(req.body?.rarity, 20, 'common');
            const quantity = toPositiveInt(req.body?.quantity, 1);
            const icon = safeText(req.body?.icon, MAX_ITEM_ICON, '');
            const description = safeText(req.body?.description, MAX_ITEM_DESC, '');
            const updatedBy = safeText(req.body?.updatedBy, 60, 'admin');

            const db = getDB();
            const doc = {
                name,
                nameLower: name.toLowerCase(),
                type,
                rarity,
                quantity,
                icon,
                description,
                createdAt: new Date(),
                updatedAt: new Date(),
                updatedBy
            };
            const result = await db.collection('inventory_items').insertOne(doc);
            await writeAdminLog('inventory_item_created', { itemId: String(result.insertedId), name, updatedBy });
            return res.status(201).json({ success: true, id: String(result.insertedId) });
        } catch (error) {
            console.error('Error creant item inventari:', error);
            return res.status(500).json({ success: false, error: 'No s\'ha pogut crear l\'item.' });
        }
    }

    static async updateInventoryItem(req, res) {
        try {
            const id = String(req.params.id || '').trim();
            if (!isValidObjectId(id)) return res.status(400).json({ success: false, error: 'ID invàlid.' });
            const name = safeText(req.body?.name, MAX_ITEM_NAME);
            if (!name) return res.status(400).json({ success: false, error: 'El nom és obligatori.' });

            const updatedBy = safeText(req.body?.updatedBy, 60, 'admin');
            const patch = {
                name,
                nameLower: name.toLowerCase(),
                type: safeText(req.body?.type, 20, 'consumable'),
                rarity: safeText(req.body?.rarity, 20, 'common'),
                quantity: toPositiveInt(req.body?.quantity, 1),
                icon: safeText(req.body?.icon, MAX_ITEM_ICON, ''),
                description: safeText(req.body?.description, MAX_ITEM_DESC, ''),
                updatedAt: new Date(),
                updatedBy
            };

            const db = getDB();
            const result = await db.collection('inventory_items').updateOne(
                { _id: new ObjectId(id) },
                { $set: patch }
            );
            if (!result.matchedCount) {
                return res.status(404).json({ success: false, error: 'Item no trobat.' });
            }
            await writeAdminLog('inventory_item_updated', { itemId: id, updatedBy });
            return res.json({ success: true });
        } catch (error) {
            console.error('Error editant item inventari:', error);
            return res.status(500).json({ success: false, error: 'No s\'ha pogut actualitzar l\'item.' });
        }
    }

    static async deleteInventoryItem(req, res) {
        try {
            const id = String(req.params.id || '').trim();
            if (!isValidObjectId(id)) return res.status(400).json({ success: false, error: 'ID invàlid.' });
            const updatedBy = safeText(req.body?.updatedBy || req.query?.updatedBy, 60, 'admin');

            const db = getDB();
            const result = await db.collection('inventory_items').deleteOne({ _id: new ObjectId(id) });
            if (!result.deletedCount) return res.status(404).json({ success: false, error: 'Item no trobat.' });
            await writeAdminLog('inventory_item_deleted', { itemId: id, updatedBy });
            return res.json({ success: true });
        } catch (error) {
            console.error('Error eliminant item inventari:', error);
            return res.status(500).json({ success: false, error: 'No s\'ha pogut eliminar l\'item.' });
        }
    }

    static async listUsers(req, res) {
        try {
            const db = getDB();
            const users = await db.collection('users')
                .find({}, { projection: { username: 1, email: 1, verified: 1, suspended: 1, createdAt: 1 } })
                .sort({ createdAt: -1 })
                .limit(300)
                .toArray();

            return res.json({
                success: true,
                users: users.map((user) => ({
                    id: String(user._id),
                    username: user.username || '',
                    email: user.email || '',
                    verified: Boolean(user.verified),
                    suspended: Boolean(user.suspended),
                    createdAt: user.createdAt || null
                }))
            });
        } catch (error) {
            console.error('Error llistant usuaris admin:', error);
            return res.status(500).json({ success: false, error: 'No s\'han pogut carregar els usuaris.' });
        }
    }

    static async toggleUserSuspension(req, res) {
        try {
            const userId = String(req.params.userId || '').trim();
            if (!isValidObjectId(userId)) return res.status(400).json({ success: false, error: 'ID invàlid.' });
            const suspended = Boolean(req.body?.suspended);
            const updatedBy = safeText(req.body?.updatedBy, 60, 'admin');
            const db = getDB();
            const result = await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $set: { suspended, suspendedAt: suspended ? new Date() : null } }
            );
            if (!result.matchedCount) return res.status(404).json({ success: false, error: 'Usuari no trobat.' });
            await writeAdminLog('user_suspension_changed', { userId, suspended, updatedBy });
            return res.json({ success: true });
        } catch (error) {
            console.error('Error canviant estat usuari:', error);
            return res.status(500).json({ success: false, error: 'No s\'ha pogut canviar l\'estat de l\'usuari.' });
        }
    }

    static async listLogs(req, res) {
        try {
            const db = getDB();
            const logs = await db.collection('admin_logs').find({}).sort({ createdAt: -1 }).limit(200).toArray();
            return res.json({
                success: true,
                logs: logs.map((log) => ({
                    id: String(log._id),
                    action: log.action,
                    payload: log.payload || {},
                    createdAt: log.createdAt || null
                }))
            });
        } catch (error) {
            console.error('Error carregant logs admin:', error);
            return res.status(500).json({ success: false, error: 'No s\'han pogut carregar els logs.' });
        }
    }
}

module.exports = AdminController;
