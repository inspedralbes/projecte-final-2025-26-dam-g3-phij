const { MongoClient } = require('mongodb');
require('dotenv').config();

const url = process.env.MONGO_URI || 'mongodb://localhost:27017';
const client = new MongoClient(url);
const dbName = 'valkrypt';

let db;

async function connectDB() {
    try {
        await client.connect();
        console.log('--- CONEXIÓN EXITOSA A MONGODB ---');
        db = client.db(dbName);
    } catch (error) {
        console.error('Error al conectar a MongoDB:', error);
        process.exit(1);
    }
}

function getDB() {
    if (!db) {
        throw new Error('Debes conectar la base de datos primero.');
    }
    return db;
}

module.exports = { connectDB, getDB };
