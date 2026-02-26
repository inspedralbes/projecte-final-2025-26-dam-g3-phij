require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { connectDB } = require('./config/db');
const AuthController = require('./controllers/AuthController');
const NarrativeController = require('./controllers/NarrativeController');
const roomRoutes = require('./routes/rooms');
const WebSocketManager = require('./websocket/WebSocketManager');

const app = express();
const server = http.createServer(app);

// initialize ws manager
const wsManager = new WebSocketManager(server);
app.wsManager = wsManager;

// Middleware
app.use(cors());
app.use(express.json());

// --- RUTAS DE VALKRYPT ---
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/verify', AuthController.verify);
app.post('/api/auth/login', AuthController.login);
app.post('/api/auth/logout', AuthController.logout);
app.post('/api/narrative/stream', NarrativeController.stream);
app.use('/api/rooms', roomRoutes);

app.get('/', (req, res) => res.send('⚔️ Valkrypt API v1.0 - WebSocket Enabled'));

app.get('/api/ws/rooms', (req, res) => {
    const rooms = wsManager.getAllRoomsInfo();
    res.json({ success: true, rooms });
});

app.get('/api/ws/rooms/:roomCode', (req, res) => {
    const info = wsManager.getRoomInfo(req.params.roomCode);
    res.json({ success: true, room: info });
});

const PORT = process.env.PORT || 3000;
connectDB().then(() => {
    server.listen(PORT, () => console.log(`⚔️ Servidor Valkrypt en puerto ${PORT} (WS)`));
}).catch(err => {
    console.error("No se pudo iniciar el servidor debido a la DB", err);
});
