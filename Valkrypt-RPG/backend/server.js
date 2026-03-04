require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { connectDB } = require('./config/db');
const AuthController = require('./controllers/AuthController');
const NarrativeController = require('./controllers/NarrativeController');
const roomRoutes = require('./routes/rooms');
const socialRoutes = require('./routes/social');
const WebSocketManager = require('./websocket/WebSocketManager');

const app = express();
const server = http.createServer(app);
const wsManager = new WebSocketManager(server);

app.use(cors());
app.use(express.json());

app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/verify', AuthController.verify);
app.post('/api/auth/login', AuthController.login);
app.post('/api/auth/logout', AuthController.logout);
app.get('/api/auth/profile/:userId', AuthController.getProfile);
app.put('/api/auth/profile', AuthController.updateProfile);

app.get('/api/game/campaigns', NarrativeController.getCampaigns);
app.get('/api/game/campaigns/:campaignId', NarrativeController.getCampaignById);
app.get('/api/game/saves/:userId', NarrativeController.listSaves);
app.delete('/api/game/saves/:userId/:saveId', NarrativeController.deleteSave);
app.get('/api/game/load/:userId', NarrativeController.loadProgress);
app.post('/api/game/action', NarrativeController.processAction);
app.post('/api/game/stream', NarrativeController.stream);
app.use('/api/rooms', roomRoutes);
app.use('/api/social', socialRoutes);

app.get('/api/ws/rooms', (req, res) => {
    return res.json({ success: true, rooms: wsManager.getAllRoomsInfo() });
});

app.get('/api/ws/rooms/:roomCode', (req, res) => {
    return res.json({ success: true, room: wsManager.getRoomInfo(req.params.roomCode) });
});

app.get('/', (req, res) => res.send('⚔️ Valkrypt API v1.0 - Atlas Connected + WS'));

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    server.listen(PORT, () => console.log(`⚔️ Servidor Valkrypt en puerto ${PORT}`));
}).catch(err => {
    console.error(err);
    process.exit(1);
});
