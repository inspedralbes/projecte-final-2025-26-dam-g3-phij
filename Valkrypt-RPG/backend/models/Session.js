const { getDB } = require('../config/db');
class Session {
    static collection() {
        return getDB().collection('sessions');
    }

    static normalizeUserId(userId) {
        if (!userId) return '';
        if (typeof userId === 'string') return userId;
        if (typeof userId === 'object' && userId.toString) return userId.toString();
        return String(userId);
    }

    static async start(userId, clientInfo) {
        const normalizedUserId = this.normalizeUserId(userId);
        const now = new Date();
        return await this.collection().insertOne({
            userId: normalizedUserId,
            clientInfo,
            loginAt: now,
            lastSeenAt: now,
            active: true
        });
    }

    static async touch(userId, clientInfo) {
        const normalizedUserId = this.normalizeUserId(userId);
        if (!normalizedUserId) return null;

        const now = new Date();
        const updateResult = await this.collection().updateMany(
            { userId: normalizedUserId, active: true },
            {
                $set: {
                    lastSeenAt: now,
                    ...(clientInfo ? { clientInfo } : {})
                }
            }
        );

        if (updateResult.matchedCount === 0) {
            await this.collection().insertOne({
                userId: normalizedUserId,
                clientInfo: clientInfo || 'Valkrypt-Client',
                loginAt: now,
                lastSeenAt: now,
                active: true
            });
        }

        return true;
    }

    static async end(userId) {
        const normalizedUserId = this.normalizeUserId(userId);
        return await this.collection().updateOne(
            { userId: normalizedUserId, active: true },
            { $set: { logoutAt: new Date(), lastSeenAt: new Date(), active: false } }
        );
    }
}
module.exports = Session;
