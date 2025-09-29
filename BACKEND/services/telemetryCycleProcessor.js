import TelemetryCycle from '../data/TelemetryCycle.model.js';
import logger from '../utils/logger.js';

const RATED_CAPACITY_AH = 60;
const DEFAULT_BANK_NAME = 'IPS BATT BANK';
const NET_CURRENT_EPSILON = 0.05; // Ignore near-idle noise (<0.05A)

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

    const { createdAt, ...fieldsToSet } = cycleDoc;
    fieldsToSet.updatedAt = new Date();

    await TelemetryCycle.collection.updateOne(
        filter,
        {
            $set: fieldsToSet,
            $setOnInsert: {
                createdAt: createdAt ?? new Date(),
            },
        },
        { upsert: true },
    );
}

class TelemetryCycleProcessor {
    constructor(initialState = {}) {
        const { preloadState } = initialState;
        this.cycleStateByDevice = preloadState instanceof Map ? new Map(preloadState) : new Map(); // deviceId -> { currentState, cycleDocs, identifiers }
    }

    async processDocument(doc) {
        const identifiers = extractIdentifiers(doc);
        if (!identifiers.deviceId) return;

        const netCurrent = computeNetCurrent(doc);
        const state = computeState(netCurrent);
        const stateEntry = this.cycleStateByDevice.get(identifiers.deviceId) || {
            currentState: null,
            cycleDocs: [],
            identifiers: null,
        };

        const finalizeCycle = async () => {
            if (!stateEntry.cycleDocs.length) return;
            const meta = {
                ...stateEntry.identifiers,
                state: stateEntry.currentState,
            };
            try {
                const cycleDoc = summarizeCycleDocs(stateEntry.cycleDocs, meta);
                await upsertCycle(cycleDoc);
                logger.loggerInfo(`Telemetry cycle persisted for device ${identifiers.deviceId} state=${meta.state}`);
            } catch (err) {
                logger.loggerError(`Failed to persist telemetry cycle for device ${identifiers.deviceId}: ${err?.message || err}`);
            }
            stateEntry.currentState = null;
            stateEntry.cycleDocs = [];
            stateEntry.identifiers = null;
        };

        if (state === 'idle') {
            await finalizeCycle();
            this.cycleStateByDevice.set(identifiers.deviceId, stateEntry);
            return;
        }

        const hasExistingCycle = stateEntry.currentState && stateEntry.currentState === state;
        if (!hasExistingCycle) {
            await finalizeCycle();
            stateEntry.currentState = state;
            stateEntry.identifiers = identifiers;
        }

        if (!stateEntry.identifiers) {
            stateEntry.identifiers = identifiers;
        }

        stateEntry.cycleDocs.push({ doc, netCurrent });
        this.cycleStateByDevice.set(identifiers.deviceId, stateEntry);
    }

    async flush(deviceId) {
        if (!deviceId) return;
        const stateEntry = this.cycleStateByDevice.get(deviceId);
        if (!stateEntry) return;
        const finalizeCycle = async () => {
            if (!stateEntry.cycleDocs.length) return;
            const meta = {
                ...stateEntry.identifiers,
                state: stateEntry.currentState,
            };
            try {
                const cycleDoc = summarizeCycleDocs(stateEntry.cycleDocs, meta);
                await upsertCycle(cycleDoc);
                logger.loggerInfo(`Telemetry cycle flushed for device ${deviceId} state=${meta.state}`);
            } catch (err) {
                logger.loggerError(`Failed to flush telemetry cycle for device ${deviceId}: ${err?.message || err}`);
            }
        };
        await finalizeCycle();
        this.cycleStateByDevice.delete(deviceId);
    }
}

const telemetryCycleProcessor = new TelemetryCycleProcessor();

export {
    telemetryCycleProcessor,
    TelemetryCycleProcessor,
    computeNetCurrent,
    computeState,
    summarizeCycleDocs,
    upsertCycle,
};

export default telemetryCycleProcessor;