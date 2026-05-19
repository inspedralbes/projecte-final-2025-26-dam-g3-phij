const { randomUUID } = require('crypto');

function normalizeIp(value) {
    return String(value || '')
        .split(',')[0]
        .trim();
}

function requestContext(req, res, next) {
    const requestId = req.headers['x-request-id']
        ? String(req.headers['x-request-id']).trim()
        : randomUUID();
    const startedAt = process.hrtime.bigint();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
        const finishedAt = process.hrtime.bigint();
        const durationMs = Number(finishedAt - startedAt) / 1_000_000;
        const entry = {
            level: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
            requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            status: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            userId: String(req.user?.id || req.body?.userId || req.query?.userId || '').trim() || null,
            ip: normalizeIp(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress),
            userAgent: String(req.headers['user-agent'] || '')
        };
        console.log(JSON.stringify(entry));
    });

    return next();
}

module.exports = {
    requestContext
};
