import Telemetry from '../data/Telemetry.model.js';
import TelemetryCycle from '../data/TelemetryCycle.model.js';
import logger from '../utils/logger.js';

const RATED_CAPACITY_AH = 60;
const DEFAULT_BANK_NAME = 'IPS BATT BANK';
const ABNORMAL_TEMP_C = 45;
const CURRENT_MULTIPLIER_THRESHOLD = 1.25; // > 125% of rated capacity is abnormal

function parseDateMaybe(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function minutesBetween(start, end) {
    const diffMs = end.getTime() - start.getTime();
    return Math.max(0, diffMs / 60000);
}

function calcAmpHours(latest, previous) {
    if (!latest) return 0;
    const telemetry = latest.telemetry || {};
    const charging = Number(telemetry?.currents?.charging || 0);
    const discharging = Number(telemetry?.currents?.discharging || 0);
    const netCurrent = charging - discharging;

    if (!previous) {
        // fallback: treat as single minute sample
        return Math.max(0, netCurrent) * (1 / 60);
    }

    const start = new Date(previous.timestamp);
    const end = new Date(latest.timestamp);
    const minutes = minutesBetween(start, end) || 1;
    const hours = minutes / 60;
    const netAh = netCurrent * hours;
    return netAh >= 0 ? netAh : 0;
}

function normalizeDoc(raw, previous) {
    if (!raw) return null;
    const telemetry = raw.telemetry || {};
    const charging = Number(telemetry?.currents?.charging || 0);
    const discharging = Number(telemetry?.currents?.discharging || 0);
    const load = Number(telemetry?.currents?.load || 0);
    const netCurrent = charging - discharging;

    const ampHours = calcAmpHours(raw, previous);

    const session = {
        deviceId: raw.deviceFull?.deviceId || raw.device?.DI,
        batteryId: raw.deviceFull?.batteryId || raw.device?.BI,
        macId: raw.deviceFull?.macId || raw.device?.MI,
        timestamp: raw.timestamp,
        ampHours,
        ampHourPercent: Math.min(100, (ampHours / RATED_CAPACITY_AH) * 100),
        temperatureC: Array.isArray(telemetry?.temperatures) ? Math.max(...telemetry.temperatures) : null,
        chargingCurrent: charging,
        dischargingCurrent: discharging,
        loadCurrent: load,
        packVoltage: telemetry?.packVoltage ?? null,
        currents: telemetry?.currents || null,
        voltages: telemetry?.voltages || null,
        ratedCapacityAh: RATED_CAPACITY_AH,
        mode: netCurrent > 0 ? 'charging' : netCurrent < 0 ? 'discharging' : 'idle',
    };

    const abnormalTemperature = session.temperatureC !== null && session.temperatureC > ABNORMAL_TEMP_C;
    const abnormalCurrent = Math.abs(netCurrent) > RATED_CAPACITY_AH * CURRENT_MULTIPLIER_THRESHOLD;

    return {
        ...session,
        netCurrent,
        abnormalTemperature,
        abnormalCurrent,
    };
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

export async function batteryStateReport(req, res) {
    try {
        const di = String(req.query.di || '').trim();
        if (!di) return res.fail("The 'di' query parameter is required.", 400);

        const from = parseDateMaybe(req.query.from);
        const to = parseDateMaybe(req.query.to);
        const requestedState = typeof req.query.state === 'string' ? req.query.state.toLowerCase() : null;
        const allowedStates = new Set(['charging', 'discharging']);
        const stateFilter = requestedState && allowedStates.has(requestedState) ? requestedState : null;

        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
        const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize || '50'), 10)));

        const match = { deviceId: di };
        if (from || to) {
            match.startTimestamp = {};
            if (from) match.startTimestamp.$gte = from;
            if (to) match.startTimestamp.$lte = to;
        }
        if (stateFilter) match.state = stateFilter;

        const collection = TelemetryCycle.collection;

        const [total, sessionsRaw] = await Promise.all([
            collection.countDocuments(match),
            collection
                .find(match)
                .sort({ startTimestamp: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .toArray(),
        ]);

        const summaryAgg = await collection
            .aggregate([
                { $match: match },
                {
                    $group: {
                        _id: null,
                        totalSessions: { $sum: 1 },
                        totalAmpHours: { $sum: '$ampHours' },
                        totalChargeAmpHours: {
                            $sum: {
                                $cond: [{ $eq: ['$state', 'charging'] }, '$ampHours', 0],
                            },
                        },
                        totalDischargeAmpHours: {
                            $sum: {
                                $cond: [{ $eq: ['$state', 'discharging'] }, '$ampHours', 0],
                            },
                        },
                    },
                },
            ])
            .toArray();

        const summaryDoc = summaryAgg[0] || null;
        const summary = {
            totalSessions: summaryDoc?.totalSessions || 0,
            totalAmpHours: summaryDoc?.totalAmpHours || 0,
            totalChargeAmpHours: summaryDoc?.totalChargeAmpHours || 0,
            totalDischargeAmpHours: summaryDoc?.totalDischargeAmpHours || 0,
        };

        const sessions = sessionsRaw.map((cycle) => ({
            deviceId: cycle.deviceId,
            batteryId: cycle.batteryId,
            macId: cycle.macId,
            bankName: cycle.bankName || DEFAULT_BANK_NAME,
            state: cycle.state,
            startTimestamp: cycle.startTimestamp,
            endTimestamp: cycle.endTimestamp,
            durationSeconds: cycle.durationSeconds,
            ampHours: cycle.ampHours,
            ampHourPercent: Math.min(100, cycle.ampHourPercent ?? 0),
            ratedCapacityAh: cycle.ratedCapacityAh ?? RATED_CAPACITY_AH,
            ambientTemperature: cycle.ambientTemperature || null,
            current: cycle.current || null,
            powerAvg: cycle.powerAvg ?? null,
            sessionCount: cycle.sessionCount ?? null,
        }));

        return res.ok(
            {
                deviceId: di,
                ratedCapacityAh: RATED_CAPACITY_AH,
                summary,
                sessions,
                pagination: {
                    page,
                    pageSize,
                    total,
                    pageCount: Math.ceil(total / pageSize),
                },
            },
            'Battery state report fetched successfully.',
        );
    } catch (err) {
        logger.loggerError(`batteryStateReport error: ${err.message || err}`);
        return res.fail('Unable to fetch battery state report. Please try again later.', 500);
    }
}