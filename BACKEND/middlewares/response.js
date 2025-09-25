// Adds res.ok and res.fail helpers to standardize API responses
// Usage:
//   res.ok(data, message?, status?) -> { success: true, message, data }
//   res.fail(message?, status?, data?) -> { success: false, message, data }
export function responseFormatter(_req, res, next) {
    res.ok = function (data = null, message = 'Request successful', status = 200) {
        return res.status(status).json({ success: true, message, data });
    };
    res.fail = function (message = 'Request failed', status = 400, data = null) {
        return res.status(status).json({ success: false, message, data });
    };
    next();
}

export default responseFormatter;