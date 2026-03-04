const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const Session = require('../models/Session');

let chatIndexesEnsured = false;
const PRESENCE_ONLINE_WINDOW_MS = 90 * 1000;

function normalizeUsername(value) {
    return String(value || '').trim();
}

function normalizeFriendName(value) {
    if (typeof value === 'string') return normalizeUsername(value);
    if (value && typeof value === 'object') {
        if (typeof value.username === 'string') return normalizeUsername(value.username);
        if (typeof value.name === 'string') return normalizeUsername(value.name);
    }
    return '';
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toUsernameSet(values) {
    const set = new Set();
    (Array.isArray(values) ? values : []).forEach((name) => {
        const normalized = normalizeFriendName(name).toLowerCase();
        if (normalized) set.add(normalized);
    });
    return set;
}

function normalizeUsernameArray(values) {
    return (Array.isArray(values) ? values : [])
        .map((value) => normalizeFriendName(value))
        .filter(Boolean);
}

async function findUserByUsernameCI(db, username) {
    const normalized = normalizeUsername(username);
    if (!normalized) return null;
    return db.collection('users').findOne({
        username: { $regex: `^${escapeRegex(normalized)}$`, $options: 'i' }
    });
}

function conversationIdFor(userA, userB) {
    const participants = [String(userA || ''), String(userB || '')];
    participants.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    return participants.join('::');
}

function getFriendRequestState(user) {
    return {
        incoming: normalizeUsernameArray(user?.friendRequests?.incoming),
        outgoing: normalizeUsernameArray(user?.friendRequests?.outgoing)
    };
}

async function ensureChatIndexes(db) {
    if (chatIndexesEnsured) return;
    await db.collection('private_messages').createIndex({ conversationId: 1, createdAt: 1 });
    await db.collection('sessions').createIndex({ userId: 1, active: 1, lastSeenAt: -1 });
    chatIndexesEnsured = true;
}

class SocialController {
    static async heartbeat(req, res) {
        try {
            const { userId } = req.body || {};
            if (!userId || !ObjectId.isValid(String(userId))) {
                return res.status(400).json({ success: false, error: 'userId no valido' });
            }

            const db = getDB();
            const user = await db.collection('users').findOne(
                { _id: new ObjectId(String(userId)) },
                { projection: { _id: 1 } }
            );
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            await Session.touch(String(user._id), req.headers['user-agent'] || 'Valkrypt-Client');
            return res.json({ success: true, at: new Date().toISOString() });
        } catch (error) {
            console.error('Error social heartbeat:', error);
            return res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    static async getState(req, res) {
        try {
            const db = getDB();
            const { userId } = req.params;

            if (!userId || !ObjectId.isValid(userId)) {
                return res.status(400).json({ success: false, error: 'userId no valido' });
            }

            const user = await db.collection('users').findOne(
                { _id: new ObjectId(userId) },
                { projection: { username: 1, friends: 1, friendRequests: 1 } }
            );
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const requests = getFriendRequestState(user);
            const friendNames = normalizeUsernameArray(user.friends);
            const friendPresence = {};

            if (friendNames.length > 0) {
                const friendUsers = await db.collection('users').find({
                    $or: friendNames.map((username) => ({
                        username: { $regex: `^${escapeRegex(username)}$`, $options: 'i' }
                    }))
                }, { projection: { _id: 1, username: 1 } }).toArray();

                const friendByUsername = new Map(
                    friendUsers.map((friendUser) => [String(friendUser.username || '').toLowerCase(), friendUser])
                );

                const friendIdsForQuery = [];
                friendUsers.forEach((friendUser) => {
                    const idString = String(friendUser._id);
                    friendIdsForQuery.push(idString);
                    if (ObjectId.isValid(idString)) {
                        friendIdsForQuery.push(new ObjectId(idString));
                    }
                });

                let onlineSessionUserIds = new Set();
                if (friendIdsForQuery.length > 0) {
                    const cutoff = new Date(Date.now() - PRESENCE_ONLINE_WINDOW_MS);
                    const activeSessions = await db.collection('sessions').find({
                        active: true,
                        userId: { $in: friendIdsForQuery },
                        $or: [
                            { lastSeenAt: { $gte: cutoff } },
                            { loginAt: { $gte: cutoff }, lastSeenAt: { $exists: false } }
                        ]
                    }, { projection: { userId: 1 } }).toArray();

                    onlineSessionUserIds = new Set(activeSessions.map((session) => String(session.userId)));
                }

                friendNames.forEach((name) => {
                    const friendUser = friendByUsername.get(name.toLowerCase());
                    const isOnline = Boolean(friendUser && onlineSessionUserIds.has(String(friendUser._id)));
                    friendPresence[name.toLowerCase()] = {
                        username: name,
                        status: isOnline ? 'online' : 'offline',
                        statusLabel: isOnline ? 'Conectado' : 'Desconectado'
                    };
                });
            }

            return res.json({
                success: true,
                username: user.username,
                friends: friendNames,
                friendRequests: requests,
                presence: friendPresence
            });
        } catch (error) {
            console.error('Error social state:', error);
            return res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    static async searchUsers(req, res) {
        try {
            const db = getDB();
            const { userId, q } = req.query;
            const queryText = normalizeUsername(q);

            if (!userId || !ObjectId.isValid(String(userId))) {
                return res.status(400).json({ success: false, error: 'userId no valido' });
            }
            if (queryText.length < 2) {
                return res.status(400).json({ success: false, error: 'Introduce al menos 2 caracteres' });
            }

            const currentUser = await db.collection('users').findOne({ _id: new ObjectId(String(userId)) });
            if (!currentUser) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const requests = getFriendRequestState(currentUser);
            const excluded = new Set([
                currentUser.username.toLowerCase(),
                ...toUsernameSet(currentUser.friends),
                ...toUsernameSet(requests.incoming),
                ...toUsernameSet(requests.outgoing)
            ]);

            const found = await db.collection('users')
                .find({
                    username: { $regex: escapeRegex(queryText), $options: 'i' }
                }, { projection: { username: 1 } })
                .limit(10)
                .toArray();

            const users = found
                .map((u) => u.username)
                .filter((username) => !excluded.has(String(username || '').toLowerCase()))
                .slice(0, 8);

            return res.json({ success: true, users });
        } catch (error) {
            console.error('Error search users:', error);
            return res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    static async sendFriendRequest(req, res) {
        try {
            const db = getDB();
            const { fromUserId, toUsername } = req.body;
            const targetUsername = normalizeUsername(toUsername);

            if (!fromUserId || !ObjectId.isValid(String(fromUserId))) {
                return res.status(400).json({ success: false, error: 'fromUserId no valido' });
            }
            if (!targetUsername) {
                return res.status(400).json({ success: false, error: 'toUsername requerido' });
            }

            const fromUser = await db.collection('users').findOne({ _id: new ObjectId(String(fromUserId)) });
            if (!fromUser) {
                return res.status(404).json({ success: false, error: 'Usuario emisor no encontrado' });
            }

            const toUser = await findUserByUsernameCI(db, targetUsername);
            if (!toUser) {
                return res.status(404).json({ success: false, error: 'Usuario destino no encontrado' });
            }
            if (String(fromUser._id) === String(toUser._id)) {
                return res.status(400).json({ success: false, error: 'No puedes agregarte a ti mismo' });
            }

            const fromFriends = toUsernameSet(fromUser.friends);
            if (fromFriends.has(String(toUser.username).toLowerCase())) {
                return res.status(409).json({ success: false, error: 'Ya sois amigos' });
            }

            const fromRequests = getFriendRequestState(fromUser);
            if (
                toUsernameSet(fromRequests.outgoing).has(String(toUser.username).toLowerCase()) ||
                toUsernameSet(fromRequests.incoming).has(String(toUser.username).toLowerCase())
            ) {
                return res.status(409).json({ success: false, error: 'Ya existe una solicitud pendiente' });
            }

            await Promise.all([
                db.collection('users').updateOne(
                    { _id: fromUser._id },
                    { $addToSet: { 'friendRequests.outgoing': toUser.username } }
                ),
                db.collection('users').updateOne(
                    { _id: toUser._id },
                    { $addToSet: { 'friendRequests.incoming': fromUser.username } }
                )
            ]);

            return res.json({
                success: true,
                message: `Solicitud enviada a ${toUser.username}`
            });
        } catch (error) {
            console.error('Error send friend request:', error);
            return res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    static async acceptFriendRequest(req, res) {
        try {
            const db = getDB();
            const { userId, fromUsername } = req.body;
            const fromName = normalizeUsername(fromUsername);

            if (!userId || !ObjectId.isValid(String(userId))) {
                return res.status(400).json({ success: false, error: 'userId no valido' });
            }
            if (!fromName) {
                return res.status(400).json({ success: false, error: 'fromUsername requerido' });
            }

            const user = await db.collection('users').findOne({ _id: new ObjectId(String(userId)) });
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const fromUser = await findUserByUsernameCI(db, fromName);
            if (!fromUser) {
                return res.status(404).json({ success: false, error: 'Usuario solicitante no encontrado' });
            }

            const incoming = toUsernameSet(getFriendRequestState(user).incoming);
            if (!incoming.has(String(fromUser.username).toLowerCase())) {
                return res.status(409).json({ success: false, error: 'No existe solicitud pendiente' });
            }

            await Promise.all([
                db.collection('users').updateOne(
                    { _id: user._id },
                    {
                        $pull: {
                            'friendRequests.incoming': fromUser.username,
                            'friendRequests.outgoing': fromUser.username
                        },
                        $addToSet: { friends: fromUser.username }
                    }
                ),
                db.collection('users').updateOne(
                    { _id: fromUser._id },
                    {
                        $pull: {
                            'friendRequests.outgoing': user.username,
                            'friendRequests.incoming': user.username
                        },
                        $addToSet: { friends: user.username }
                    }
                )
            ]);

            return res.json({ success: true, message: `Ahora eres aliado de ${fromUser.username}` });
        } catch (error) {
            console.error('Error accept friend request:', error);
            return res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    static async rejectFriendRequest(req, res) {
        try {
            const db = getDB();
            const { userId, fromUsername } = req.body;
            const fromName = normalizeUsername(fromUsername);

            if (!userId || !ObjectId.isValid(String(userId))) {
                return res.status(400).json({ success: false, error: 'userId no valido' });
            }
            if (!fromName) {
                return res.status(400).json({ success: false, error: 'fromUsername requerido' });
            }

            const user = await db.collection('users').findOne({ _id: new ObjectId(String(userId)) });
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const fromUser = await findUserByUsernameCI(db, fromName);
            if (!fromUser) {
                return res.status(404).json({ success: false, error: 'Usuario solicitante no encontrado' });
            }

            await Promise.all([
                db.collection('users').updateOne(
                    { _id: user._id },
                    {
                        $pull: {
                            'friendRequests.incoming': fromUser.username,
                            'friendRequests.outgoing': fromUser.username
                        }
                    }
                ),
                db.collection('users').updateOne(
                    { _id: fromUser._id },
                    {
                        $pull: {
                            'friendRequests.outgoing': user.username,
                            'friendRequests.incoming': user.username
                        }
                    }
                )
            ]);

            return res.json({ success: true, message: `Solicitud rechazada de ${fromUser.username}` });
        } catch (error) {
            console.error('Error reject friend request:', error);
            return res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    static async getChatMessages(req, res) {
        try {
            const db = getDB();
            const { userId, with: withUsername } = req.query;
            const withName = normalizeUsername(withUsername);
            const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 60));

            if (!userId || !ObjectId.isValid(String(userId))) {
                return res.status(400).json({ success: false, error: 'userId no valido' });
            }
            if (!withName) {
                return res.status(400).json({ success: false, error: 'Parametro with requerido' });
            }

            const user = await db.collection('users').findOne({ _id: new ObjectId(String(userId)) });
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const friend = await findUserByUsernameCI(db, withName);
            if (!friend) {
                return res.status(404).json({ success: false, error: 'Usuario de chat no encontrado' });
            }

            const friendsSet = toUsernameSet(user.friends);
            if (!friendsSet.has(String(friend.username).toLowerCase())) {
                return res.status(403).json({ success: false, error: 'Solo puedes chatear con aliados' });
            }

            await ensureChatIndexes(db);
            const conversationId = conversationIdFor(user.username, friend.username);
            const query = { conversationId };

            const since = req.query.since ? new Date(String(req.query.since)) : null;
            if (since && !Number.isNaN(since.getTime())) {
                query.createdAt = { $gt: since };
            }

            const messages = await db.collection('private_messages')
                .find(query)
                .sort({ createdAt: 1 })
                .limit(limit)
                .toArray();

            return res.json({
                success: true,
                conversationId,
                messages: messages.map((message) => ({
                    id: String(message._id),
                    fromUsername: message.fromUsername,
                    toUsername: message.toUsername,
                    message: message.message,
                    createdAt: message.createdAt
                }))
            });
        } catch (error) {
            console.error('Error get chat:', error);
            return res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    static async sendChatMessage(req, res) {
        try {
            const db = getDB();
            const { fromUserId, toUsername, message } = req.body;
            const toName = normalizeUsername(toUsername);
            const text = String(message || '').trim();

            if (!fromUserId || !ObjectId.isValid(String(fromUserId))) {
                return res.status(400).json({ success: false, error: 'fromUserId no valido' });
            }
            if (!toName) {
                return res.status(400).json({ success: false, error: 'toUsername requerido' });
            }
            if (!text) {
                return res.status(400).json({ success: false, error: 'Mensaje vacio' });
            }
            if (text.length > 1000) {
                return res.status(400).json({ success: false, error: 'Mensaje demasiado largo (max 1000)' });
            }

            const fromUser = await db.collection('users').findOne({ _id: new ObjectId(String(fromUserId)) });
            if (!fromUser) {
                return res.status(404).json({ success: false, error: 'Usuario emisor no encontrado' });
            }

            const toUser = await findUserByUsernameCI(db, toName);
            if (!toUser) {
                return res.status(404).json({ success: false, error: 'Usuario destino no encontrado' });
            }

            const friendsSet = toUsernameSet(fromUser.friends);
            if (!friendsSet.has(String(toUser.username).toLowerCase())) {
                return res.status(403).json({ success: false, error: 'Solo puedes chatear con aliados' });
            }

            await ensureChatIndexes(db);
            const conversationId = conversationIdFor(fromUser.username, toUser.username);
            const payload = {
                conversationId,
                participants: [fromUser.username, toUser.username],
                fromUsername: fromUser.username,
                toUsername: toUser.username,
                message: text,
                createdAt: new Date()
            };

            const result = await db.collection('private_messages').insertOne(payload);
            return res.status(201).json({
                success: true,
                message: {
                    id: String(result.insertedId),
                    fromUsername: payload.fromUsername,
                    toUsername: payload.toUsername,
                    message: payload.message,
                    createdAt: payload.createdAt
                }
            });
        } catch (error) {
            console.error('Error send chat:', error);
            return res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }
}

module.exports = SocialController;
