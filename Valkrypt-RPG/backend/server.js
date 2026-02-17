require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if(password === '123456') {
        return res.json({
            success: true,
            token: 'fake-jwt-token-123',
            user: { username, role: 'player' }
        });
    }
    return res.status(401).json({ error: 'Credenciales inválidas (Prueba 123456)' });
});

app.get('/', (req, res) => res.send('Valkrypt API v0.1 Running'));

const PORT = 3000;
app.listen(PORT, () => console.log(`⚔️ Servidor en puerto ${PORT}`));