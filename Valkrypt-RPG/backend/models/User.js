const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

class User {
    static collection() {
        return getDB().collection('users');
    }

    static async findByUsername(username) {
        return await this.collection().findOne({ username });
    }

    static async findByEmail(email) {
        return await this.collection().findOne({ email: email.toLowerCase() });
    }

    static async create(userData) {
        const username = String(userData.username || '').trim();
        return await this.collection().insertOne({
            username,
            email: userData.email.toLowerCase(),
            password: userData.password,
            verified: Boolean(userData.verified),
            verificationCodeHash: userData.verificationCodeHash || null,
            verificationCodeExpiresAt: userData.verificationCodeExpiresAt || null,
            verificationAttempts: userData.verificationAttempts || 0,
            createdAt: new Date(),
            character: userData.character || null,
            profile: {
                displayName: username,
                title: userData?.profile?.title || 'Aventurero',
                faction: userData?.profile?.faction || 'Independiente',
                bio: userData?.profile?.bio || '',
                avatar: userData?.profile?.avatar || ''
            },
            saveData: {},
            friends: [],
            friendRequests: {
                incoming: [],
                outgoing: []
            }
        });
    }

    static async updateVerificationCode(userId, verificationCodeHash, verificationCodeExpiresAt) {
        return await this.collection().updateOne(
            { _id: userId },
            {
                $set: {
                    verificationCodeHash,
                    verificationCodeExpiresAt,
                    verificationAttempts: 0
                }
            }
        );
    }

    static async markVerified(userId) {
        return await this.collection().updateOne(
            { _id: userId },
            {
                $set: {
                    verified: true,
                    verifiedAt: new Date()
                },
                $unset: {
                    verificationCodeHash: '',
                    verificationCodeExpiresAt: '',
                    verificationAttempts: ''
                }
            }
        );
    }

    static async incrementVerificationAttempts(userId) {
        return await this.collection().updateOne(
            { _id: userId },
            { $inc: { verificationAttempts: 1 } }
        );
    }

    static async updateVerification(userId, verified) {
        return await this.collection().updateOne(
            { _id: userId },
            { $set: { verified: Boolean(verified) } }
        );
    }

    static async findById(userId) {
        const id = typeof userId === 'string' ? new ObjectId(userId) : userId;
        return await this.collection().findOne({ _id: id });
    }

    static async updateProfile(userId, updates) {
        const id = typeof userId === 'string' ? new ObjectId(userId) : userId;
        return await this.collection().updateOne(
            { _id: id },
            {
                $set: {
                    ...updates,
                    updatedAt: new Date()
                }
            }
        );
    }
}

module.exports = User;
