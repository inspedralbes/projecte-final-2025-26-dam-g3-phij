const { getDB } = require('../config/db');
class Session {
    static collection() {
        return getDB().collection('sessions');
    }
    static async start(userId, clientInfo) {
        return await this.collection().insertOne({
            userId,
            clientInfo,
            loginAt: new Date(),
            active: true
        });
    }
    static async end(userId) {
        return await this.collection().updateOne(
            { userId, active: true },
            { $set: { logoutAt: new Date(), active: false } }
        );
    }
}
module.exports = Session;