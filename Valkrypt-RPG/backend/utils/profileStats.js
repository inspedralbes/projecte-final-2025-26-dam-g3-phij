const { ObjectId } = require('mongodb');

const PROFILE_LIMITS = {
    displayName: 32,
    title: 60,
    faction: 40,
    bio: 320,
    avatar: 500,
    character: 80
};

const ACHIEVEMENT_DEFS = [
    { id: 'primera_cronica', title: 'Primera Cronica', description: 'Guardar tu primera aventura.', key: 'savedCampaigns', goal: 1 },
    { id: 'archivero', title: 'Archivero del Reino', description: 'Mantener 3 crónicas guardadas.', key: 'savedCampaigns', goal: 3 },
    { id: 'capitulo_cerrado', title: 'Capitulo Cerrado', description: 'Completar un capitulo de campaña.', key: 'completedChapters', goal: 1 },
    { id: 'veterano_del_abismo', title: 'Veterano del Abismo', description: 'Completar 3 capitulos.', key: 'completedChapters', goal: 3 },
    { id: 'estratega', title: 'Estratega', description: 'Tomar 25 decisiones de juego.', key: 'decisionEntries', goal: 25 },
    { id: 'cronista', title: 'Cronista', description: 'Acumular 30 eventos narrativos.', key: 'narrativeEntries', goal: 30 },
    { id: 'alianza_forjada', title: 'Alianza Forjada', description: 'Conseguir 1 aliado.', key: 'friends', goal: 1 },
    { id: 'red_de_aliados', title: 'Red de Aliados', description: 'Conseguir 5 aliados.', key: 'friends', goal: 5 },
    { id: 'anfitrion', title: 'Anfitrion', description: 'Crear al menos 1 sala.', key: 'roomsHosted', goal: 1 },
    { id: 'lider_de_escuadra', title: 'Lider de Escuadra', description: 'Finalizar una partida cooperativa.', key: 'roomsCompleted', goal: 1 },
    { id: 'mensajero', title: 'Mensajero', description: 'Enviar 20 mensajes privados.', key: 'messagesSent', goal: 20 },
    { id: 'tactico_coop', title: 'Tactico Cooperativo', description: 'Jugar 12 turnos cooperativos.', key: 'coopTurnsTaken', goal: 12 }
];

const sanitizeText = (value, maxLength, { allowEmpty = true } = {}) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value)
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .trim();

    if (!allowEmpty && !normalized) return null;
    if (normalized.length > maxLength) {
        return normalized.slice(0, maxLength);
    }
    return normalized;
};

const sanitizeProfileForResponse = (user) => {
    const username = String(user?.username || '').trim();
    const profile = user?.profile && typeof user.profile === 'object' ? user.profile : {};

    return {
        displayName: sanitizeText(profile.displayName, PROFILE_LIMITS.displayName, { allowEmpty: true }) || username,
        title: sanitizeText(profile.title, PROFILE_LIMITS.title, { allowEmpty: true }) || 'Aventurero',
        faction: sanitizeText(profile.faction, PROFILE_LIMITS.faction, { allowEmpty: true }) || 'Independiente',
        bio: sanitizeText(profile.bio, PROFILE_LIMITS.bio, { allowEmpty: true }) || '',
        avatar: sanitizeText(profile.avatar, PROFILE_LIMITS.avatar, { allowEmpty: true }) || ''
    };
};

function normalizePositiveInt(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.floor(parsed);
}

function countWords(text) {
    return String(text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

function rankFromScore(score) {
    if (score >= 1000) return { id: 'leyenda', label: 'Leyenda del Reino' };
    if (score >= 600) return { id: 'comandante', label: 'Comandante de Vanguardias' };
    if (score >= 320) return { id: 'estratega', label: 'Estratega del Bastion' };
    if (score >= 140) return { id: 'cronista', label: 'Cronista de Campana' };
    return { id: 'aprendiz', label: 'Aprendiz de Aventura' };
}

function buildAchievements(stats) {
    return ACHIEVEMENT_DEFS.map((entry) => {
        const progress = normalizePositiveInt(stats?.[entry.key], 0);
        const goal = normalizePositiveInt(entry.goal, 1);
        return {
            id: entry.id,
            title: entry.title,
            description: entry.description,
            progress,
            goal,
            unlocked: progress >= goal
        };
    });
}

async function buildAdvancedProfileData(db, user) {
    const userIdString = String(user?._id || '').trim();
    const userObjectId = ObjectId.isValid(userIdString) ? new ObjectId(userIdString) : null;
    const username = String(user?.username || '').trim();

    const saveQuery = userObjectId
        ? { userId: { $in: [userObjectId, userIdString] } }
        : { userId: userIdString };

    const [saves, rooms, sentMessages, receivedMessages] = await Promise.all([
        db.collection('saves').find(saveQuery).toArray(),
        db.collection('rooms').find({ 'players.userId': userIdString }).toArray(),
        db.collection('private_messages').countDocuments({ fromUsername: username }),
        db.collection('private_messages').countDocuments({ toUsername: username })
    ]);

    const uniqueCampaigns = new Set();
    let activeSaves = 0;
    let completedChapters = 0;
    let narrativeEntries = 0;
    let decisionEntries = 0;
    let totalStoryWords = 0;
    let totalTurns = 0;
    let maxDayReached = 0;
    let maxDayLimit = 0;

    saves.forEach((save) => {
        const status = String(save?.chapterStatus || 'active').toLowerCase();
        if (status === 'completed') completedChapters += 1;
        else activeSaves += 1;

        const campaignKey = String(save?.campaignId || save?.campaignTitle || '').trim();
        if (campaignKey) uniqueCampaigns.add(campaignKey.toLowerCase());

        const day = normalizePositiveInt(save?.day, 0);
        const dayLimit = normalizePositiveInt(save?.dayLimit, 0);
        const turn = normalizePositiveInt(save?.turn, 0);
        maxDayReached = Math.max(maxDayReached, day);
        maxDayLimit = Math.max(maxDayLimit, dayLimit);
        totalTurns += turn;

        const history = Array.isArray(save?.history) ? save.history : [];
        history.forEach((entry) => {
            const type = String(entry?.type || '').toLowerCase();
            const content = String(entry?.content || '').trim();
            if (type === 'narrative') narrativeEntries += 1;
            else decisionEntries += 1;
            totalStoryWords += countWords(content);
        });
    });

    let roomsHosted = 0;
    let roomsCompleted = 0;
    let coopTurnsTaken = 0;

    rooms.forEach((room) => {
        if (String(room?.hostId || '').trim() === userIdString) roomsHosted += 1;
        if (String(room?.gameState?.phase || '').toLowerCase() === 'completed') roomsCompleted += 1;

        const log = Array.isArray(room?.gameState?.log) ? room.gameState.log : [];
        log.forEach((entry) => {
            if (String(entry?.type || '').toLowerCase() !== 'turn') return;
            if (String(entry?.userId || '').trim() !== userIdString) return;
            coopTurnsTaken += 1;
        });
    });

    const friendsCount = Array.isArray(user?.friends) ? user.friends.length : 0;
    const incomingRequests = Array.isArray(user?.friendRequests?.incoming) ? user.friendRequests.incoming.length : 0;
    const outgoingRequests = Array.isArray(user?.friendRequests?.outgoing) ? user.friendRequests.outgoing.length : 0;

    const stats = {
        friends: friendsCount,
        incomingRequests,
        outgoingRequests,
        savedCampaigns: saves.length,
        activeSaves,
        completedChapters,
        uniqueCampaigns: uniqueCampaigns.size,
        narrativeEntries,
        decisionEntries,
        totalStoryWords,
        totalTurns,
        maxDayReached,
        maxDayLimit,
        roomsJoined: rooms.length,
        roomsHosted,
        roomsCompleted,
        coopTurnsTaken,
        messagesSent: Number(sentMessages || 0),
        messagesReceived: Number(receivedMessages || 0)
    };

    const score = Math.round(
        (stats.completedChapters * 130) +
        (stats.savedCampaigns * 24) +
        (stats.roomsCompleted * 70) +
        (stats.coopTurnsTaken * 3) +
        (stats.decisionEntries * 2) +
        (stats.friends * 14) +
        (stats.messagesSent * 1.2) +
        (Math.min(stats.totalStoryWords, 10000) / 38)
    );

    return {
        stats: {
            ...stats,
            profileScore: score,
            rank: rankFromScore(score)
        },
        achievements: buildAchievements(stats)
    };
}

module.exports = {
    PROFILE_LIMITS,
    sanitizeText,
    sanitizeProfileForResponse,
    buildAdvancedProfileData
};
