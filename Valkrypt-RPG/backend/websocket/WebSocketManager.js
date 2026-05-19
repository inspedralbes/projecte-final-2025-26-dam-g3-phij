const WebSocket = require('ws');

const wsRooms = new Map();
const wsMiniCoopRooms = new Map();

class WebSocketManager {
    constructor(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws', clientTracking: true });
        this.wss.on('connection', (ws) => this.handleConnection(ws));
        console.log('⚔️ WebSocket Manager initialized');
    }

    handleConnection(ws) {
        ws.on('message', (data) => this.handleMessage(ws, data));
        ws.on('close', () => this.handleDisconnect(ws));
        ws.on('error', (err) => console.error('WebSocket error', err));
    }

    handleMessage(ws, data) {
        try {
            const msg = JSON.parse(data);
            const { type, roomCode, userId, username, payload } = msg;
            if (userId) ws.userId = userId;
            if (username) ws.username = username;
            switch (type) {
                case 'joinRoom':
                    this.joinRoom(ws, roomCode, userId, username);
                    break;
                case 'leaveRoom':
                    this.leaveRoom(ws, roomCode);
                    break;
                case 'gameAction':
                    this.broadcast(roomCode, {
                        type: 'playerAction',
                        roomCode,
                        userId,
                        username,
                        action: payload?.action || '',
                        message: payload?.message || ''
                    }, ws);
                    break;
                case 'chatMessage':
                    this.broadcast(roomCode, {
                        type: 'chat',
                        roomCode,
                        username,
                        message: payload?.message || ''
                    }, ws);
                    break;
                case 'startGame':
                    this.broadcast(roomCode, {
                        type: 'gameStarted',
                        roomCode,
                        userId,
                        username
                    }, ws);
                    break;
                case 'updateGameState':
                    this.broadcast(roomCode, {
                        type: 'gameStateUpdated',
                        roomCode,
                        payload: payload || {}
                    }, ws);
                    break;
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                case 'joinMiniCoop':
                    this.joinMiniCoop(ws, roomCode, userId, username);
                    break;
                case 'leaveMiniCoop':
                    this.leaveMiniCoop(ws, roomCode);
                    break;
                case 'miniCoopReady':
                    this.broadcastMiniCoop(roomCode, {
                        type: 'miniCoopSignal',
                        roomCode,
                        signal: 'ready',
                        userId,
                        username,
                        ready: Boolean(payload?.ready)
                    }, ws);
                    break;
                case 'miniCoopScore':
                    this.broadcastMiniCoop(roomCode, {
                        type: 'miniCoopSignal',
                        roomCode,
                        signal: 'score',
                        userId,
                        username,
                        score: Number(payload?.score || 0)
                    }, ws);
                    break;
                case 'miniCoopState':
                    this.broadcastMiniCoop(roomCode, {
                        type: 'miniCoopSignal',
                        roomCode,
                        signal: 'state'
                    }, ws);
                    break;
                default:
                    console.error('Unknown message type:', type);
            }
        } catch (error) {
            console.error('WebSocket parse error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    }

    joinRoom(ws, roomCode, userId, username) {
        ws.roomCode = roomCode;
        ws.userId = userId;
        ws.username = username;
        if (!wsRooms.has(roomCode)) wsRooms.set(roomCode, []);
        wsRooms.get(roomCode).push(ws);
        ws.send(JSON.stringify({ type: 'joined', roomCode, userId, username, players: wsRooms.get(roomCode).length }));
        this.broadcast(roomCode, {
            type: 'playerJoined',
            roomCode,
            userId,
            username,
            totalPlayers: wsRooms.get(roomCode).length
        }, ws);
    }

    leaveRoom(ws, roomCode) {
        const room = wsRooms.get(roomCode);
        if (room) {
            const idx = room.indexOf(ws);
            if (idx > -1) room.splice(idx, 1);
            if (room.length === 0) wsRooms.delete(roomCode);
            else this.broadcast(roomCode, {
                type: 'playerLeft',
                roomCode,
                userId: ws.userId,
                username: ws.username,
                totalPlayers: room.length
            });
        }
        ws.close();
    }

    handleDisconnect(ws) {
        if (ws.miniRoomCode) {
            const room = wsMiniCoopRooms.get(ws.miniRoomCode);
            if (room) {
                const idx = room.indexOf(ws);
                if (idx > -1) room.splice(idx, 1);
                if (room.length === 0) wsMiniCoopRooms.delete(ws.miniRoomCode);
                else this.broadcastMiniCoop(ws.miniRoomCode, {
                    type: 'miniCoopPresence',
                    roomCode: ws.miniRoomCode,
                    userId: ws.userId,
                    username: ws.username,
                    status: 'left',
                    totalPlayers: room.length
                });
            }
        }

        if (ws.roomCode) {
            const room = wsRooms.get(ws.roomCode);
            if (room) {
                const idx = room.indexOf(ws);
                if (idx > -1) room.splice(idx, 1);
                if (room.length === 0) wsRooms.delete(ws.roomCode);
                else this.broadcast(ws.roomCode, {
                    type: 'playerLeft',
                    roomCode: ws.roomCode,
                    userId: ws.userId,
                    username: ws.username,
                    totalPlayers: room.length
                });
            }
        }
    }

    joinMiniCoop(ws, roomCode, userId, username) {
        if (!roomCode) return;
        ws.miniRoomCode = roomCode;
        ws.userId = userId;
        ws.username = username;
        if (!wsMiniCoopRooms.has(roomCode)) wsMiniCoopRooms.set(roomCode, []);
        const room = wsMiniCoopRooms.get(roomCode);
        if (!room.includes(ws)) room.push(ws);
        ws.send(JSON.stringify({
            type: 'miniCoopJoined',
            roomCode,
            userId,
            username,
            totalPlayers: room.length
        }));
        this.broadcastMiniCoop(roomCode, {
            type: 'miniCoopPresence',
            roomCode,
            userId,
            username,
            status: 'joined',
            totalPlayers: room.length
        }, ws);
    }

    leaveMiniCoop(ws, roomCode) {
        const room = wsMiniCoopRooms.get(roomCode);
        if (!room) return;
        const idx = room.indexOf(ws);
        if (idx > -1) room.splice(idx, 1);
        if (room.length === 0) wsMiniCoopRooms.delete(roomCode);
        else this.broadcastMiniCoop(roomCode, {
            type: 'miniCoopPresence',
            roomCode,
            userId: ws.userId,
            username: ws.username,
            status: 'left',
            totalPlayers: room.length
        });
        ws.miniRoomCode = null;
    }

    broadcastMiniCoop(roomCode, message, except = null) {
        const room = wsMiniCoopRooms.get(roomCode);
        if (!room) return;
        const data = JSON.stringify(message);
        room.forEach(s => {
            if (s !== except && s.readyState === WebSocket.OPEN) s.send(data);
        });
    }

    sendToUser(userId, message) {
        if (!userId) return;
        const data = JSON.stringify(message);
        this.wss.clients.forEach((client) => {
            if (client.readyState !== WebSocket.OPEN) return;
            if (String(client.userId || '') !== String(userId)) return;
            client.send(data);
        });
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
