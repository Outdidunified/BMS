import Telemetry from '../data/Telemetry.model.js';
import logger from '../utils/logger.js';

export async function analytics(req, res) {
    try {
        const { di, from, to } = req.query;
        if (!di) return res.fail('The \'di\' query parameter is required.', 400);

        const match = { $or: [{ 'device.DI': di }, { 'deviceFull.deviceId': di }] };
        if (from || to) {
            match.timestamp = {};
            if (from) match.timestamp.$gte = new Date(from);
            if (to) match.timestamp.$lte = new Date(to);
        }

        // Prefer full-form telemetry fields; fallback to legacy params
        const projectNumFields = {
            pv: { $ifNull: ['$telemetry.packVoltage', '$params.pv'] },
            cc: { $ifNull: ['$telemetry.currents.charging', '$params.cc'] },
            dc: { $ifNull: ['$telemetry.currents.discharging', '$params.dc'] },
            lc: { $ifNull: ['$telemetry.currents.load', '$params.lc'] },
        };
        for (let i = 1; i <= 24; i++) projectNumFields[`v${i}`] = { $ifNull: [`$telemetry.voltages.${i - 1}`, `$params.v${i}`] };
        for (let i = 1; i <= 25; i++) projectNumFields[`T${i}`] = { $ifNull: [`$telemetry.temperatures.${i - 1}`, `$params.T${i}`] };

        // Build aggregation without $accumulator to support lower Atlas tiers
        const keys = ['pv', 'cc', 'dc', 'lc'];
        for (let i = 1; i <= 24; i++) keys.push(`v${i}`);
        for (let i = 1; i <= 25; i++) keys.push(`T${i}`);

        const group = { _id: null, count: { $sum: 1 } };
        keys.forEach((k) => {
            group[`${k}_min`] = { $min: `$${k}` };
            group[`${k}_max`] = { $max: `$${k}` };
            group[`${k}_avg`] = { $avg: `$${k}` };
        });

        const reshape = { _id: 0, count: 1, avg: {}, min: {}, max: {} };
        keys.forEach((k) => {
            reshape.avg[k] = `$${k}_avg`;
            reshape.min[k] = `$${k}_min`;
            reshape.max[k] = `$${k}_max`;
        });

        const pipeline = [
            { $match: match },
            { $project: projectNumFields },
            { $group: group },
            { $project: reshape },
        ];

        const [result] = await Telemetry.collection.aggregate(pipeline).toArray();
        logger.loggerInfo(`Analytics fetched for DI=${di} count=${result?.count ?? 0}`);
        return res.ok(result || { avg: {}, min: {}, max: {}, count: 0 }, 'Analytics summary');
    } catch (err) {
        logger.loggerError(`analytics error: ${err.message || err}`);
        return res.fail('Unable to compute analytics. Please try again later.', 500);
    }
}