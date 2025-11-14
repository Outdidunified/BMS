// Optional x-api-key; never blocks request. Exposes it on req if present.
export function authDevice(req, _res, next) {
    const apiKey = req.get('x-api-key') || null;
    req.apiKey = apiKey;
    next();
}