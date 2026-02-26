const { getDB } = require('../config/db');

class Room {
    static collection() {
        return getDB().collection('rooms');
    }

    static async create(roomData) {
        const room = {
            roomCode: roomData.roomCode,
            roomName: roomData.roomName,
            hostId: roomData.hostId,
            hostName: roomData.hostName,
            maxPlayers: roomData.maxPlayers || 4,
            players: [{
                userId: roomData.hostId,
                username: roomData.hostName,
                character: roomData.character || null,
                joinedAt: new Date()
            }],
            status: 'waiting',
            gameState: {},
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await this.collection().insertOne(room);
        return { ...room, _id: result.insertedId };
    }

    static async findByCode(roomCode) {
        return await this.collection().findOne({ roomCode });
    }

    static async findById(roomId) {
        const { ObjectId } = require('mongodb');
        return await this.collection().findOne({ _id: new ObjectId(roomId) });
    }

    static async addPlayer(roomCode, userId, username, character) {
        return await this.collection().updateOne(
            { roomCode },
            {
                $push: {
                    players: {
                        userId,
                        username,
                        character: character || null,
                        joinedAt: new Date()
                    }
                },
                $set: { updatedAt: new Date() }
            }
        );
    }

    static async removePlayer(roomCode, userId) {
        return await this.collection().updateOne(
            { roomCode },
            {
                $pull: { players: { userId } },
                $set: { updatedAt: new Date() }
            }
        );
    }

    static async updateGameState(roomCode, gameState) {
        return await this.collection().updateOne(
            { roomCode },
            {
                $set: {
                    gameState,
                    updatedAt: new Date()
                }
            }
        );
    }

    static async updateStatus(roomCode, status) {
        return await this.collection().updateOne(
            { roomCode },
            {
                $set: {
                    status,
                    updatedAt: new Date()
                }
            }
        );
    }

    static async delete(roomCode) {
        return await this.collection().deleteOne({ roomCode });
    }

    static async getActiveRooms() {
        return await this.collection()
            .find({ status: 'waiting' })
            .toArray();
    }

    static async getPlayerRooms(userId) {
        return await this.collection()
            .find({ 'players.userId': userId })
            .toArray();
    }
}

module.exports = Room;
