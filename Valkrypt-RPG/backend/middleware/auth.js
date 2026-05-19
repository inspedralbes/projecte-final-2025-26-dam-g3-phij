const jwt = require('jsonwebtoken');

function parseAdminUsernames() {
    return String(process.env.ADMIN_USERNAMES || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
}

function isAdminUser(username) {
    const normalized = String(username || '').trim().toLowerCase();
    if (!normalized) return false;
    return parseAdminUsernames().includes(normalized);
}

function getBearerToken(req) {
    const header = String(req.headers?.authorization || '');
    if (!header.toLowerCase().startsWith('bearer ')) return '';
    return header.slice(7).trim();
}

function requireAuth(req, res, next) {
    const token = getBearerToken(req);
    if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autenticación requerido.' });
    }

    const secret = String(process.env.JWT_SECRET || '').trim();
    if (!secret) {
        return res.status(500).json({ success: false, error: 'JWT_SECRET no configurado.' });
    }

    try {
        const payload = jwt.verify(token, secret);
        req.user = {
            id: String(payload?.id || ''),
            username: String(payload?.username || ''),
            isAdmin: Boolean(payload?.isAdmin || isAdminUser(payload?.username))
        };
        return next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Token inválido o expirado.' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Acceso restringido a administradores.' });
    }
    return next();
}

function ensureUserMatchesFrom(source = 'body', field = 'userId') {
    return (req, res, next) => {
        const rawValue = source === 'params'
            ? req.params?.[field]
            : source === 'query'
                ? req.query?.[field]
                : req.body?.[field];
        const targetUserId = String(rawValue || '').trim();

        if (!targetUserId) {
            return res.status(400).json({ success: false, error: `${field} es obligatorio.` });
        }

        const requesterId = String(req.user?.id || '').trim();
        if (!requesterId) {
            return res.status(401).json({ success: false, error: 'Usuario no autenticado.' });
        }

        if (req.user?.isAdmin || requesterId === targetUserId) {
            return next();
        }

        return res.status(403).json({ success: false, error: 'No autorizado para operar sobre este usuario.' });
    };
}

module.exports = {
    requireAuth,
    requireAdmin,
    ensureUserMatchesFrom,
    isAdminUser
};
