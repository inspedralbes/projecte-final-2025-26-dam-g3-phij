const { getDB } = require('../config/db');
class User {
    static collection() {
        return getDB().collection('users');
    }
    static async create(userData) {
        const result = await this.collection().insertOne({
            username: userData.username,
            email: userData.email,
            password: userData.password, 
            isVerified: false,
            verificationCode: userData.verificationCode, 
            friends: [],
            createdAt: new Date(),
            saveData: {} 
        });
        return result;
    }
    static async findByUsername(username) {
        return await this.collection().findOne({ username });
    }
    static async verify(username, code) {
        const result = await this.collection().updateOne(
            { username, verificationCode: code },
            { $set: { isVerified: true }, $unset: { verificationCode: "" } }
        );
        return result.modifiedCount > 0;
    }
}
module.exports = User;
