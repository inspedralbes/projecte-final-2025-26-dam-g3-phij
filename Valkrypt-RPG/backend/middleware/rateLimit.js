const buckets = new Map();

function now() {
    return Date.now();
}

function getClientKey(req) {
    const userId = String(req.user?.id || '').trim();
    const ip = String(req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').trim();
    return userId ? `uid:${userId}` : `ip:${ip}`;
}

function cleanupExpired(windowMs) {
    const limitTime = now() - windowMs * 2;
    for (const [key, value] of buckets.entries()) {
        if (value.resetAt < limitTime) buckets.delete(key);
    }
}

function rateLimit({ windowMs = 60_000, max = 30, message = 'Demasiadas solicitudes, inténtalo de nuevo.' } = {}) {
    return (req, res, next) => {
        cleanupExpired(windowMs);
        const key = `${req.path}|${getClientKey(req)}`;
        const currentTs = now();
        const record = buckets.get(key);

        if (!record || record.resetAt <= currentTs) {
            buckets.set(key, {
                count: 1,
                resetAt: currentTs + windowMs
            });
            return next();
        }

        if (record.count >= max) {
            const retrySeconds = Math.max(1, Math.ceil((record.resetAt - currentTs) / 1000));
            res.setHeader('Retry-After', String(retrySeconds));
            return res.status(429).json({ success: false, error: message, retryAfterSeconds: retrySeconds });
        }

        record.count += 1;
        buckets.set(key, record);
        return next();
    };
}

module.exports = {
    rateLimit
};
