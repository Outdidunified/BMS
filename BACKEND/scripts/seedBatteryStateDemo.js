import { randomUUID } from 'crypto';
import { connectDB, closeDB, collections } from '../config/db.js';

const DEVICE_ID = 'BMS_DEMO';
const BATTERY_ID = 'BAT_DEMO';
const MAC_ID = '02:00:00:00:99:99';
const RATED_CAPACITY_AH = 60;

function buildVoltages(baseVoltage, step = 0.005) {
    return Array.from({ length: 24 }, (_, index) => {
        const offset = ((index % 6) - 2) * step;
        return Number((baseVoltage + offset).toFixed(2));
    });
}

function computePackVoltage(voltages) {
    const sum = voltages.reduce((acc, value) => acc + value, 0);
    return Number(sum.toFixed(2));
}

function buildTemperatures(baseTemp, spread = 0.6) {
    return Array.from({ length: 8 }, (_, index) => {
        const offset = (index % 4) - 1.5;
        return Number((baseTemp + offset * (spread / 3)).toFixed(1));
    });
}

const telemetrySamples = [
    {
        timestamp: '2024-11-19T02:35:11.812Z',
        chargingCurrent: 18.6,
        dischargingCurrent: 0,
        loadCurrent: 2.1,
        baseVoltage: 3.78,
        baseTemperature: 25.1,
    },
    {
        timestamp: '2024-11-19T03:05:11.812Z',
        chargingCurrent: 16.2,
        dischargingCurrent: 0,
        loadCurrent: 2.8,
        baseVoltage: 3.8,
        baseTemperature: 25.6,
    },
    {
        timestamp: '2024-11-19T04:10:11.812Z',
        chargingCurrent: 12.7,
        dischargingCurrent: 0,
        loadCurrent: 3.2,
        baseVoltage: 3.83,
        baseTemperature: 26.2,
    },
    {
        timestamp: '2024-11-19T05:20:44.091Z',
        chargingCurrent: 9.1,
        dischargingCurrent: 0,
        loadCurrent: 2.9,
        baseVoltage: 3.86,
        baseTemperature: 26.8,
    },
    {
        timestamp: '2024-11-19T12:03:57.440Z',
        chargingCurrent: 0,
        dischargingCurrent: 17.4,
        loadCurrent: 16.5,
        baseVoltage: 3.93,
        baseTemperature: 27.8,
    },
    {
        timestamp: '2024-11-19T12:45:57.440Z',
        chargingCurrent: 0,
        dischargingCurrent: 19.2,
        loadCurrent: 18.1,
        baseVoltage: 3.88,
        baseTemperature: 28.3,
    },
    {
        timestamp: '2024-11-19T13:47:29.610Z',
        chargingCurrent: 0,
        dischargingCurrent: 14.6,
        loadCurrent: 15.8,
        baseVoltage: 3.82,
        baseTemperature: 27.5,
    },
    {
        timestamp: '2024-11-20T00:11:43.003Z',
        chargingCurrent: 13.5,
        dischargingCurrent: 0,
        loadCurrent: 2.6,
        baseVoltage: 3.74,
        baseTemperature: 24.1,
    },
    {
        timestamp: '2024-11-20T02:07:43.003Z',
        chargingCurrent: 16.9,
        dischargingCurrent: 0,
        loadCurrent: 3.1,
        baseVoltage: 3.79,
        baseTemperature: 24.8,
    },
    {
        timestamp: '2024-11-20T04:02:18.219Z',
        chargingCurrent: 18.3,
        dischargingCurrent: 0,
        loadCurrent: 2.9,
        baseVoltage: 3.86,
        baseTemperature: 25.4,
    },
];

const cycleSummaries = [
    {
        sessionId: 'cycle-2024-11-19T02:35:11.812Z',
        deviceId: DEVICE_ID,
        batteryId: BATTERY_ID,
        macId: MAC_ID,
        bankName: 'Bank A',
        state: 'charging',
        startTimestamp: new Date('2024-11-19T02:35:11.812Z'),
        endTimestamp: new Date('2024-11-19T05:20:44.091Z'),
        durationSeconds: 10013,
        ampHours: 42.6,
        ampHourPercent: 71.0,
        ratedCapacityAh: RATED_CAPACITY_AH,
        ambientTemperature: { min: 23.4, max: 27.1, avg: 25.3 },
        current: { min: 4.1, max: 18.6, avg: 11.2 },
        powerAvg: 523.7,
        sessionCount: 6,
    },
    {
        sessionId: 'cycle-2024-11-19T12:03:57.440Z',
        deviceId: DEVICE_ID,
        batteryId: BATTERY_ID,
        macId: MAC_ID,
        bankName: 'Bank A',
        state: 'discharging',
        startTimestamp: new Date('2024-11-19T12:03:57.440Z'),
        endTimestamp: new Date('2024-11-19T13:47:29.610Z'),
        durationSeconds: 6182,
        ampHours: 31.8,
        ampHourPercent: 53.0,
        ratedCapacityAh: RATED_CAPACITY_AH,
        ambientTemperature: { min: 25.8, max: 29.6, avg: 27.9 },
        current: { min: 7.4, max: 23.1, avg: 16.5 },
        powerAvg: -486.4,
        sessionCount: 5,
    },
    {
        sessionId: 'cycle-2024-11-20T00:11:43.003Z',
        deviceId: DEVICE_ID,
        batteryId: BATTERY_ID,
        macId: MAC_ID,
        bankName: 'Bank B',
        state: 'charging',
        startTimestamp: new Date('2024-11-20T00:11:43.003Z'),
        endTimestamp: new Date('2024-11-20T04:02:18.219Z'),
        durationSeconds: 13935,
        ampHours: 68.3,
        ampHourPercent: 113.8,
        ratedCapacityAh: RATED_CAPACITY_AH,
        ambientTemperature: { min: 22.1, max: 26.8, avg: 24.4 },
        current: { min: 3.6, max: 21.7, avg: 12.8 },
        powerAvg: 611.2,
        sessionCount: 7,
    },
];

function toTelemetryDoc(sample) {
    const voltages = buildVoltages(sample.baseVoltage);
    const temperatures = buildTemperatures(sample.baseTemperature);
    const packVoltage = computePackVoltage(voltages);

    return {
        _id: randomUUID(),
        deviceFull: {
            deviceId: DEVICE_ID,
            batteryId: BATTERY_ID,
            macId: MAC_ID,
        },
        device: {
            DI: DEVICE_ID,
            BI: BATTERY_ID,
            MI: MAC_ID,
        },
        telemetry: {
            packVoltage,
            voltages,
            currents: {
                charging: sample.chargingCurrent,
                discharging: sample.dischargingCurrent,
                load: sample.loadCurrent,
            },
            temperatures,
        },
        timestamp: new Date(sample.timestamp),
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'demo-seed',
    };
}

function toCycleDoc(summary) {
    const now = new Date();
    return {
        ...summary,
        createdAt: now,
        updatedAt: now,
        ampHourPercent: summary.ampHourPercent,
        ratedCapacityAh: summary.ratedCapacityAh,
        powerAvg: summary.powerAvg,
    };
}

export async function seedBatteryStateDemo() {
    const createdAt = new Date();
    await connectDB();
    const { devices, telemetry, telemetryCycles } = collections();

    await devices.updateOne(
        { deviceId: DEVICE_ID },
        {
            $set: {
                deviceId: DEVICE_ID,
                batteryId: BATTERY_ID,
                macId: MAC_ID,
                status: true,
                createdAt,
                updatedAt: new Date(),
            },
        },
        { upsert: true },
    );

    const telemetryDocs = telemetrySamples.map(toTelemetryDoc);

    if (telemetryDocs.length) {
        await telemetry.deleteMany({ 'deviceFull.deviceId': DEVICE_ID });
        await telemetry.insertMany(telemetryDocs);
    }

    const cycleDocs = cycleSummaries.map(toCycleDoc);

    if (cycleDocs.length) {
        await telemetryCycles.deleteMany({ deviceId: DEVICE_ID });
        await telemetryCycles.insertMany(cycleDocs);
    }

    console.log(`Seeded demo telemetry and cycles for ${DEVICE_ID}.`);
    await closeDB();
}

async function run() {
    try {
        await seedBatteryStateDemo();
        process.exit(0);
    } catch (error) {
        console.error('Failed to seed battery state demo data:', error);
        await closeDB();
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run();
}