require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const AuthController = require('./controllers/AuthController');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- RUTAS DE VALKRYPT ---
app.post('/api/register', AuthController.register);
app.post('/api/verify', AuthController.verify);
app.post('/api/login', AuthController.login);
app.post('/api/logout', AuthController.logout);
app.get('/', (req, res) => res.send('⚔️ Valkrypt API v1.0 - Atlas Connected'));
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
    app.listen(PORT, () => console.log(`⚔️ Servidor Valkrypt en puerto ${PORT}`));
}).catch(err => {
    console.error("No se pudo iniciar el servidor debido a la DB", err);
});