const WebSocket = require('ws');

// store by room code
const wsRooms = new Map();

class WebSocketManager {
    constructor(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws', clientTracking: true });
        this.wss.on('connection', (ws) => this.handleConnection(ws));
        console.log('⚔️ WebSocket Manager initialized');
    }

    handleConnection(ws) {
        console.log('⚔️ WebSocket client connected');
        ws.on('message', (data) => this.handleMessage(ws, data));
        ws.on('close', () => this.handleDisconnect(ws));
        ws.on('error', (err) => console.error('WS error', err));
    }

    handleMessage(ws, data) {
        try {
            const msg = JSON.parse(data);
            const { type, roomCode, userId, username, payload } = msg;
            switch (type) {
                case 'joinRoom':
                    this.joinRoom(ws, roomCode, userId, username);
                    break;
                case 'leaveRoom':
                    this.leaveRoom(ws, roomCode);
                    break;
                case 'gameAction':
                    this.broadcast(roomCode, { ...msg, type: 'playerAction' }, ws);
                    break;
                case 'chatMessage':
                    this.broadcast(roomCode, msg, ws);
                    break;
                case 'updateGameState':
                    this.broadcast(roomCode, msg, ws);
                    break;
                case 'startGame':
                    this.broadcast(roomCode, msg, ws);
                    break;
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                default:
                    console.log('Unknown ws message type', type);
            }
        } catch (error) {
            console.error('WS parse error', error);
            ws.send(JSON.stringify({ type: 'error', message: 'invalid format' }));
        }
    }

    joinRoom(ws, roomCode, userId, username) {
        ws.roomCode = roomCode;
        ws.userId = userId;
        ws.username = username;
        if (!wsRooms.has(roomCode)) wsRooms.set(roomCode, []);
        wsRooms.get(roomCode).push(ws);
        ws.send(JSON.stringify({ type: 'joined', roomCode, players: wsRooms.get(roomCode).length }));
        this.broadcast(roomCode, { type: 'playerJoined', username, totalPlayers: wsRooms.get(roomCode).length }, ws);
    }

    leaveRoom(ws, roomCode) {
        const room = wsRooms.get(roomCode);
        if (room) {
            const idx = room.indexOf(ws);
            if (idx > -1) room.splice(idx, 1);
            if (room.length === 0) wsRooms.delete(roomCode);
            else this.broadcast(roomCode, { type: 'playerLeft', username: ws.username, totalPlayers: room.length });
        }
        ws.close();
    }

    handleDisconnect(ws) {
        if (ws.roomCode) {
            const room = wsRooms.get(ws.roomCode);
            if (room) {
                const idx = room.indexOf(ws);
                if (idx > -1) room.splice(idx, 1);
                if (room.length === 0) wsRooms.delete(ws.roomCode);
                else this.broadcast(ws.roomCode, { type: 'playerDisconnected', username: ws.username, totalPlayers: room.length });
            }
        }
    }

    broadcast(roomCode, message, except = null) {
        const room = wsRooms.get(roomCode);
        if (!room) return;
        const data = JSON.stringify(message);
        room.forEach(s => {
            if (s !== except && s.readyState === WebSocket.OPEN) s.send(data);
        });
    }

    getAllRoomsInfo() {
        const list = [];
        wsRooms.forEach((room, code) => {
            list.push({ roomCode: code, playerCount: room.length });
        });
        return list;
    }

    getRoomInfo(roomCode) {
        const room = wsRooms.get(roomCode) || [];
        return { roomCode, playerCount: room.length };
    }
}

module.exports = WebSocketManager;
