import { connectDB, closeDB } from '../config/db.js';
import Telemetry from '../data/Telemetry.model.js';
import TelemetryCycle from '../data/TelemetryCycle.model.js';
import logger from '../utils/logger.js';

const RATED_CAPACITY_AH = 60;
const DEFAULT_BANK_NAME = 'IPS BATT BANK';
const NET_CURRENT_EPSILON = 0.05; // Ignore near-idle noise (<0.05A)
const BATCH_LIMIT = 5000;

function extractIdentifiers(doc) {
    const deviceId = doc.deviceFull?.deviceId || doc.device?.DI || null;
    const batteryId = doc.deviceFull?.batteryId || doc.device?.BI || null;
    const macId = doc.deviceFull?.macId || doc.device?.MI || null;
    return { deviceId, batteryId, macId };
}

function computeNetCurrent(doc) {
    const telemetry = doc.telemetry || {};
    const charging = Number(telemetry?.currents?.charging || 0);
    const discharging = Number(telemetry?.currents?.discharging || 0);
    return charging - discharging;
}

function computeState(netCurrent) {
    if (netCurrent > NET_CURRENT_EPSILON) return 'charging';
    if (netCurrent < -NET_CURRENT_EPSILON) return 'discharging';
    return 'idle';
}

function minutesBetween(start, end) {
    const diffMs = end.getTime() - start.getTime();
    return Math.max(0, diffMs / 60000);
}

function summarizeCycleDocs(cycleDocs, meta) {
    if (!cycleDocs.length) return null;

    const startDoc = cycleDocs[0];
    const endDoc = cycleDocs[cycleDocs.length - 1];
    const startDate = new Date(startDoc.doc.timestamp);
    const endDate = new Date(endDoc.doc.timestamp);
    const durationSeconds = Math.max(0, (endDate.getTime() - startDate.getTime()) / 1000);

    let ampHours = 0;
    for (let i = 1; i < cycleDocs.length; i += 1) {
        const prev = cycleDocs[i - 1];
        const curr = cycleDocs[i];
        const prevDate = new Date(prev.doc.timestamp);
        const currDate = new Date(curr.doc.timestamp);
        const hours = minutesBetween(prevDate, currDate) / 60;
        if (hours <= 0) continue;
        const avgNetAbs = (Math.abs(prev.netCurrent) + Math.abs(curr.netCurrent)) / 2;
        ampHours += avgNetAbs * hours;
    }

    const temperatureSamples = [];
    const netCurrents = [];
    const packVoltages = [];

    cycleDocs.forEach(({ doc, netCurrent }) => {
        const telemetry = doc.telemetry || {};
        if (Array.isArray(telemetry?.temperatures)) {
            telemetry.temperatures.forEach((value) => {
                if (Number.isFinite(value)) temperatureSamples.push(Number(value));
            });
        }
        netCurrents.push(Math.abs(netCurrent));
        if (Number.isFinite(telemetry?.packVoltage)) packVoltages.push(Number(telemetry.packVoltage));
    });

    const avg = (arr) => (arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : null);
    const min = (arr) => (arr.length ? Math.min(...arr) : null);
    const max = (arr) => (arr.length ? Math.max(...arr) : null);

    const ampHourPercent = RATED_CAPACITY_AH > 0 ? (ampHours / RATED_CAPACITY_AH) * 100 : 0;
    const avgCurrent = avg(netCurrents) ?? 0;
    const avgVoltage = avg(packVoltages) ?? 0;
    const powerAvg = avgVoltage * avgCurrent;

    return {
        deviceId: meta.deviceId,
        batteryId: meta.batteryId,
        macId: meta.macId,
        bankName: DEFAULT_BANK_NAME,
        state: meta.state,
        startTimestamp: startDate,
        endTimestamp: endDate,
        durationSeconds,
        ampHours,
        ampHourPercent,
        ratedCapacityAh: RATED_CAPACITY_AH,
        ambientTemperature: temperatureSamples.length
            ? {
                min: min(temperatureSamples),
                max: max(temperatureSamples),
                avg: avg(temperatureSamples),
            }
            : null,
        current: netCurrents.length
            ? {
                min: min(netCurrents),
                max: max(netCurrents),
                avg: avgCurrent,
            }
            : null,
        powerAvg: Number.isFinite(powerAvg) ? powerAvg : null,
        sessionCount: cycleDocs.length,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

async function upsertCycle(cycleDoc) {
    if (!cycleDoc) return;
    const filter = {
        deviceId: cycleDoc.deviceId,
        state: cycleDoc.state,
        startTimestamp: cycleDoc.startTimestamp,
        endTimestamp: cycleDoc.endTimestamp,
    };

    await TelemetryCycle.collection.updateOne(
        filter,
        {
            $set: {
                ...cycleDoc,
                createdAt: undefined,
            },
            $setOnInsert: {
                createdAt: cycleDoc.createdAt,
            },
        },
        { upsert: true },
    );
}

async function processDevice(deviceId) {
    const lastCycle = await TelemetryCycle.collection
        .find({ deviceId })
        .sort({ endTimestamp: -1 })
        .limit(1)
        .toArray();
    const lastTimestamp = lastCycle[0]?.endTimestamp || null;

    const match = [];
    if (deviceId) match.push({ 'deviceFull.deviceId': deviceId });
    match.push({ 'device.DI': deviceId });

    const query = { $or: match };
    if (lastTimestamp) {
        query.timestamp = { $gt: lastTimestamp };
    }

    const cursor = Telemetry.collection
        .find(query)
        .sort({ timestamp: 1 })
        .limit(BATCH_LIMIT);

    const cycleState = {
        currentState: null,
        cycleDocs: [],
        identifiers: null,
    };

    let processedDocs = 0;

    const finalizeCycle = async () => {
        if (!cycleState.cycleDocs.length) return;
        const meta = {
            ...cycleState.identifiers,
            state: cycleState.currentState,
        };
        const cycleDoc = summarizeCycleDocs(cycleState.cycleDocs, meta);
        await upsertCycle(cycleDoc);
        cycleState.currentState = null;
        cycleState.cycleDocs = [];
        cycleState.identifiers = null;
    };

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        processedDocs += 1;
        const netCurrent = computeNetCurrent(doc);
        const state = computeState(netCurrent);

        if (state === 'idle') {
            await finalizeCycle();
            continue;
        }

        const identifiers = extractIdentifiers(doc);
        if (!identifiers.deviceId) continue;

        const hasExistingCycle = cycleState.currentState && cycleState.currentState === state;
        if (!hasExistingCycle) {
            await finalizeCycle();
            cycleState.currentState = state;
            cycleState.identifiers = identifiers;
        }

        if (!cycleState.identifiers) {
            cycleState.identifiers = identifiers;
        }

        cycleState.cycleDocs.push({ doc, netCurrent });
    }

    await finalizeCycle();
    logger.loggerInfo(`Processed ${processedDocs} telemetry docs for device ${deviceId}`);
}

async function run() {
    try {
        await connectDB();
        const deviceIds = await Telemetry.collection.distinct('deviceFull.deviceId');
        const fallbackIds = await Telemetry.collection.distinct('device.DI');
        const allDeviceIds = new Set();
        fallbackIds.forEach((id) => id && allDeviceIds.add(id));
        deviceIds.forEach((id) => id && allDeviceIds.add(id));

        for (const deviceId of allDeviceIds) {
            logger.loggerInfo(`Computing battery cycles for ${deviceId}`);
            await processDevice(deviceId);
        }
    } catch (err) {
        logger.loggerError(`Error computing telemetry cycles: ${err.message || err}`);
    } finally {
        await closeDB();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run().then(() => {
        logger.loggerSuccess('Telemetry cycles computation finished');
        process.exit(0);
    });
}