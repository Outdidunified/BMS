import Telemetry from '../data/Telemetry.model.js';
import logger from '../utils/logger.js';

function parseDateMaybe(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

export async function latestTelemetry(req, res) {
    try {
        const di = String(req.query.di || '').trim();
        if (!di) return res.fail('The \'di\' query parameter is required.', 400);

        const match = { $or: [{ 'device.DI': di }, { 'deviceFull.deviceId': di }] };
        const doc = await Telemetry.collection
            .find(match)
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray();
        const latest = doc[0] || null;
        logger.loggerInfo(`latestTelemetry di=${di} found=${!!latest}`);
        if (!latest) return res.fail('No telemetry found for the specified device.', 404);
        return res.ok(latest, 'Latest telemetry fetched successfully.');
    } catch (err) {
        logger.loggerError(`latestTelemetry error: ${err.message || err}`);
        return res.fail('Unable to fetch latest telemetry. Please try again later.', 500);
    }
}

export async function rangeTelemetry(req, res) {
    try {
        const di = String(req.query.di || '').trim();
        if (!di) return res.fail('The \'di\' query parameter is required.', 400);
        const from = parseDateMaybe(req.query.from);
        const to = parseDateMaybe(req.query.to);
        let limit = parseInt(String(req.query.limit || '200'), 10);
        if (!Number.isFinite(limit) || limit <= 0) limit = 200;
        limit = Math.min(limit, 2000);

        const match = { $or: [{ 'device.DI': di }, { 'deviceFull.deviceId': di }] };
        if (from || to) {
            match.timestamp = {};
            if (from) match.timestamp.$gte = from;
            if (to) match.timestamp.$lte = to;
        }

        const docs = await Telemetry.collection
            .find(match)
            .sort({ timestamp: 1 })
            .limit(limit)
            .toArray();
        logger.loggerInfo(`rangeTelemetry di=${di} count=${docs.length}`);
        return res.ok(docs, 'Telemetry range fetched successfully.');
    } catch (err) {
        logger.loggerError(`rangeTelemetry error: ${err.message || err}`);
        return res.fail('Unable to fetch telemetry range. Please try again later.', 500);
    }
}