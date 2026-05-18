require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./config/db');
const AuthController = require('./controllers/AuthController');
const NarrativeController = require('./controllers/NarrativeController');
const roomRoutes = require('./routes/rooms');
const socialRoutes = require('./routes/social');
const engineRoutes = require('./routes/engine');
const adminRoutes = require('./routes/admin');
const WebSocketManager = require('./websocket/WebSocketManager');

const app = express();
const server = http.createServer(app);
const wsManager = new WebSocketManager(server);

app.use(cors());
app.use(express.json());

const staticDir = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
}

app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/verify', AuthController.verify);
app.post('/api/auth/resend-otp', AuthController.resendOtp);
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
app.use('/api/engine', engineRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/ws/rooms', (req, res) => {
    return res.json({ success: true, rooms: wsManager.getAllRoomsInfo() });
});

app.get('/api/ws/rooms/:roomCode', (req, res) => {
    return res.json({ success: true, room: wsManager.getRoomInfo(req.params.roomCode) });
});

app.get('/', (req, res) => res.send('⚔️ Valkrypt API v1.0 - Atlas Connected + WS'));

if (fs.existsSync(staticDir)) {
    app.get(/^(?!\/api\/).*/, (req, res) => {
        res.sendFile(path.join(staticDir, 'index.html'));
    });
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Keep local dev proxy sockets alive long enough to avoid stale-connection resets.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.on('clientError', (error, socket) => {
    console.error('HTTP client error:', error?.code || error?.message || error);
    if (socket && socket.writable) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
});
server.on('error', (error) => {
    console.error('HTTP server error:', error);
});

connectDB().then(() => {
    server.listen(PORT, HOST, () => console.log(`⚔️ Servidor Valkrypt a ${HOST}:${PORT}`));
}).catch(err => {
    console.error(err);
    process.exit(1);
});
