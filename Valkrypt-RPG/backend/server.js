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
const { requireAuth, requireAdmin, ensureUserMatchesFrom } = require('./middleware/auth');
const { rateLimit } = require('./middleware/rateLimit');
const { requestContext } = require('./middleware/requestContext');
const { responseEnvelope } = require('./middleware/responseEnvelope');

const app = express();
const server = http.createServer(app);
const wsManager = new WebSocketManager(server);
app.locals.wsManager = wsManager;

app.use(cors());
app.use(express.json());
app.use(requestContext);
app.use(responseEnvelope);

const staticDir = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
}

app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/verify', AuthController.verify);
app.post('/api/auth/resend-otp', rateLimit({ windowMs: 60_000, max: 5, message: 'Demasiados reenvíos OTP.' }), AuthController.resendOtp);
app.post('/api/auth/login', rateLimit({ windowMs: 60_000, max: 10, message: 'Demasiados intentos de login.' }), AuthController.login);
app.post('/api/auth/logout', requireAuth, AuthController.logout);
app.get('/api/auth/profile/:userId', requireAuth, ensureUserMatchesFrom('params', 'userId'), AuthController.getProfile);
app.put('/api/auth/profile', requireAuth, ensureUserMatchesFrom('body', 'userId'), AuthController.updateProfile);

app.get('/api/game/campaigns', requireAuth, NarrativeController.getCampaigns);
app.get('/api/game/campaigns/:campaignId', requireAuth, NarrativeController.getCampaignById);
app.get('/api/game/saves/:userId', requireAuth, ensureUserMatchesFrom('params', 'userId'), NarrativeController.listSaves);
app.delete('/api/game/saves/:userId/:saveId', requireAuth, ensureUserMatchesFrom('params', 'userId'), NarrativeController.deleteSave);
app.get('/api/game/load/:userId', requireAuth, ensureUserMatchesFrom('params', 'userId'), NarrativeController.loadProgress);
app.get('/api/game/minigames/leaderboard/weekly', requireAuth, NarrativeController.getWeeklyMinigameLeaderboard);
app.get('/api/game/minigames/:userId', requireAuth, ensureUserMatchesFrom('params', 'userId'), NarrativeController.getMinigameProgress);
app.post('/api/game/minigames/complete', requireAuth, ensureUserMatchesFrom('body', 'userId'), rateLimit({ windowMs: 20_000, max: 20, message: 'Demasiadas recompensas de minijuego seguidas.' }), NarrativeController.completeMinigame);
app.post('/api/game/minigames/coop/create', requireAuth, ensureUserMatchesFrom('body', 'userId'), NarrativeController.createCoopMinigameRoom);
app.post('/api/game/minigames/coop/join', requireAuth, ensureUserMatchesFrom('body', 'userId'), NarrativeController.joinCoopMinigameRoom);
app.post('/api/game/minigames/coop/submit', requireAuth, ensureUserMatchesFrom('body', 'userId'), NarrativeController.submitCoopMinigameScore);
app.get('/api/game/minigames/coop/:roomCode', requireAuth, NarrativeController.getCoopMinigameRoom);
app.post('/api/game/minigames/coop/matchmaking/join', requireAuth, ensureUserMatchesFrom('body', 'userId'), NarrativeController.joinCoopMatchmaking);
app.post('/api/game/minigames/coop/matchmaking/leave', requireAuth, ensureUserMatchesFrom('body', 'userId'), NarrativeController.leaveCoopMatchmaking);
app.get('/api/game/minigames/coop/matchmaking/status/:userId', requireAuth, ensureUserMatchesFrom('params', 'userId'), NarrativeController.getCoopMatchmakingStatus);
app.post('/api/game/action', requireAuth, ensureUserMatchesFrom('body', 'userId'), rateLimit({ windowMs: 30_000, max: 20, message: 'Demasiadas acciones seguidas.' }), NarrativeController.processAction);
app.post('/api/game/stream', requireAuth, rateLimit({ windowMs: 60_000, max: 12, message: 'Demasiadas peticiones al narrador IA.' }), NarrativeController.stream);
app.use('/api/rooms', requireAuth, roomRoutes);
app.use('/api/social', requireAuth, socialRoutes);
app.use('/api/engine', requireAuth, engineRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);

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

app.use('/api/*', (req, res) => {
    return res.status(404).json({ code: 'not_found', error: 'Ruta API no encontrada.' });
});

app.use((error, req, res, next) => {
    console.error(`[${req.requestId || 'unknown'}] Unhandled error:`, error);
    if (res.headersSent) return next(error);
    const status = Number(error?.status || error?.statusCode || 500);
    return res.status(status).json({
        code: String(error?.code || (status >= 500 ? 'internal_error' : 'request_failed')),
        error: String(error?.message || 'Error interno del servidor.'),
        retryable: Boolean(error?.retryable ?? (status >= 500))
    });
});

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
