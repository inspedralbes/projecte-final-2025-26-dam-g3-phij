function defaultErrorCode(statusCode = 500) {
    if (statusCode === 400) return 'bad_request';
    if (statusCode === 401) return 'unauthorized';
    if (statusCode === 403) return 'forbidden';
    if (statusCode === 404) return 'not_found';
    if (statusCode === 409) return 'conflict';
    if (statusCode === 422) return 'validation_error';
    if (statusCode === 429) return 'rate_limited';
    if (statusCode >= 500) return 'internal_error';
    return 'request_failed';
}

function toErrorEnvelope(payload, statusCode, requestId) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const message = String(source.message || source.error || 'Error interno del servidor.');
    return {
        success: false,
        error: message,
        message,
        code: String(source.code || defaultErrorCode(statusCode)),
        retryable: source.retryable === undefined ? statusCode >= 500 : Boolean(source.retryable),
        requestId,
        details: source.details || null
    };
}

function responseEnvelope(req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = (payload) => {
        const statusCode = Number(res.statusCode || 200);
        const requestId = String(req.requestId || '');

        if (statusCode >= 400) {
            return originalJson(toErrorEnvelope(payload, statusCode, requestId));
        }

        if (payload && typeof payload === 'object' && !Array.isArray(payload) && !Object.prototype.hasOwnProperty.call(payload, 'requestId')) {
            return originalJson({ ...payload, requestId });
        }

        return originalJson(payload);
    };

    return next();
}

module.exports = {
    responseEnvelope
};
