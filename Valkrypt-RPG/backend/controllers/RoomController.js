const Room = require('../models/Room');
const crypto = require('crypto');

class RoomController {
    static async createRoom(req, res) {
        try {
            const { roomName, maxPlayers, userId, username, character } = req.body;

            if (!roomName || !userId || !username) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: roomName, userId, username'
                });
            }

            const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();

            const room = await Room.create({
                roomCode,
                roomName,
                maxPlayers: maxPlayers || 4,
                hostId: userId,
                hostName: username,
                character
            });

            return res.status(201).json({
                success: true,
                message: 'Room created successfully',
                room
            });
        } catch (error) {
            console.error('Error creating room:', error);
            return res.status(500).json({
                success: false,
                message: 'Error creating room',
                error: error.message
            });
        }
    }

    static async getActiveRooms(req, res) {
        try {
            const rooms = await Room.getActiveRooms();
            const availableRooms = rooms.filter(
                room => room.players.length < room.maxPlayers
            );

            return res.status(200).json({
                success: true,
                rooms: availableRooms
            });
        } catch (error) {
            console.error('Error fetching rooms:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching rooms',
                error: error.message
            });
        }
    }

    static async getRoomDetails(req, res) {
        try {
            const { roomCode } = req.params;

            if (!roomCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Room code is required'
                });
            }

            const room = await Room.findByCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            return res.status(200).json({
                success: true,
                room
            });
        } catch (error) {
            console.error('Error fetching room details:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching room details',
                error: error.message
            });
        }
    }

    static async joinRoom(req, res) {
        try {
            const { roomCode, userId, username, character } = req.body;

            if (!roomCode || !userId || !username) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: roomCode, userId, username'
                });
            }

            const room = await Room.findByCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            if (room.players.length >= room.maxPlayers) {
                return res.status(400).json({
                    success: false,
                    message: 'Room is full'
                });
            }

            const alreadyJoined = room.players.some(p => p.userId === userId);
            if (alreadyJoined) {
                return res.status(400).json({
                    success: false,
                    message: 'Player already in room'
                });
            }

            if (room.status !== 'waiting') {
                return res.status(400).json({
                    success: false,
                    message: 'Room is not accepting new players'
                });
            }

            await Room.addPlayer(roomCode, userId, username, character);

            return res.status(200).json({
                success: true,
                message: 'Joined room successfully',
                room: await Room.findByCode(roomCode)
            });
        } catch (error) {
            console.error('Error joining room:', error);
            return res.status(500).json({
                success: false,
                message: 'Error joining room',
                error: error.message
            });
        }
    }

    static async leaveRoom(req, res) {
        try {
            const { roomCode, userId } = req.body;

            if (!roomCode || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: roomCode, userId'
                });
            }

            const room = await Room.findByCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            if (room.hostId === userId) {
                await Room.delete(roomCode);
                return res.status(200).json({
                    success: true,
                    message: 'Room deleted (host left)'
                });
            }

            await Room.removePlayer(roomCode, userId);

            return res.status(200).json({
                success: true,
                message: 'Left room successfully'
            });
        } catch (error) {
            console.error('Error leaving room:', error);
            return res.status(500).json({
                success: false,
                message: 'Error leaving room',
                error: error.message
            });
        }
    }

    static async startGame(req, res) {
        try {
            const { roomCode, userId } = req.body;

            if (!roomCode || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: roomCode, userId'
                });
            }

            const room = await Room.findByCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            if (room.hostId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Only host can start the game'
                });
            }

            if (room.players.length < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Not enough players to start'
                });
            }

            await Room.updateStatus(roomCode, 'in-progress');

            return res.status(200).json({
                success: true,
                message: 'Game started',
                room: await Room.findByCode(roomCode)
            });
        } catch (error) {
            console.error('Error starting game:', error);
            return res.status(500).json({
                success: false,
                message: 'Error starting game',
                error: error.message
            });
        }
    }

    static async getPlayerRooms(req, res) {
        try {
            const { userId } = req.params;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
            }

            const rooms = await Room.getPlayerRooms(userId);

            return res.status(200).json({
                success: true,
                rooms
            });
        } catch (error) {
            console.error('Error fetching player rooms:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching player rooms',
                error: error.message
            });
        }
    }

    static async deleteRoom(req, res) {
        try {
            const { roomCode, userId } = req.body;

            if (!roomCode || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: roomCode, userId'
                });
            }

            const room = await Room.findByCode(roomCode);

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
            }

            if (room.hostId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Only the host can delete the room'
                });
            }

            await Room.delete(roomCode);

            return res.status(200).json({
                success: true,
                message: 'Room deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting room:', error);
            return res.status(500).json({
                success: false,
                message: 'Error deleting room',
                error: error.message
            });
        }
    }
}

module.exports = RoomController;
