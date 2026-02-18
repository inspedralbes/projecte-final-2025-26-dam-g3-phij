const { getDB } = require('../config/db');
class User {
    static collection() {
        return getDB().collection('users');
    }
    // METODOS
    static async findByUsername(username) {
        return await this.collection().findOne({ username });
    }

    static async findByEmail(email) {
        return await this.collection().findOne({ email: email.toLowerCase() });
    }
    static async create(userData) {
        return await this.collection().insertOne({
            username: userData.username,
            email: userData.email.toLowerCase(),
            password: userData.password, 
            verified: userData.verified || false,
            verificationCode: userData.verificationCode || null,
            createdAt: new Date(),
            saveData: {},
            friends: []
        });
    }
}

module.exports = User;