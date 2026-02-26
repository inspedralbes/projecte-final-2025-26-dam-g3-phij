const { getDB } = require('../db');
const { ObjectId } = require('mongodb');

exports.loadProgress = async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;
        const save = await db.collection('saves').findOne({ userId: new ObjectId(userId) });
        if (!save) return res.status(404).json({ error: "No hay partida" });
        res.json(save);
    } catch (error) {
        res.status(500).json({ error: "Error al cargar de Atlas" });
    }
};

exports.processAction = async (req, res) => {
    try {
        const db = getDB();
        const { userId, action } = req.body;

        const currentSave = await db.collection('saves').findOne({ userId: new ObjectId(userId) });
        
        const newEntry = { 
            type: action.type === 'combat' ? 'combat' : 'narrative', 
            content: `Has elegido: ${action.label}. La historia continúa...` 
        };

        const updatedHistory = [...currentSave.history, newEntry];

        const nextOptions = [
            { id: 'opt_' + Date.now(), label: 'Explorar más', type: 'narrative' },
            { id: 'opt_' + (Date.now()+1), label: 'Avanzar con sigilo', type: 'narrative' },
            { id: 'opt_' + (Date.now()+2), label: 'Luchar', type: 'combat' }
        ];

        const updateData = {
            $set: {
                history: updatedHistory,
                currentOptions: nextOptions,
                updatedAt: new Date()
            }
        };

        await db.collection('saves').updateOne(
            { userId: new ObjectId(userId) },
            updateData
        );

        const fullUpdate = await db.collection('saves').findOne({ userId: new ObjectId(userId) });
        res.json(fullUpdate);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el núcleo de Valkrypt" });
    }
};