import dotenv from 'dotenv';
import { connectDB, collections } from '../config/db.js';
import logger from '../utils/logger.js';

// Load env (respect NODE_ENV similar to app.js)
const env = process.env.NODE_ENV || 'production';
dotenv.config({ path: `.env.${env}` });
dotenv.config();

const devices = [
    { deviceId: 'BMS001', batteryId: 'BAT1001', macId: '02:00:00:00:00:01', status: true },
    { deviceId: 'BMS002', batteryId: 'BAT1002', macId: '02:00:00:00:00:02', status: true },
    { deviceId: 'BMS003', batteryId: 'BAT1003', macId: '02:00:00:00:00:03', status: true },
    { deviceId: 'BMS004', batteryId: 'BAT1004', macId: '02:00:00:00:00:04', status: true },
    { deviceId: 'BMS005', batteryId: 'BAT1005', macId: '02:00:00:00:00:05', status: true },
];

async function upsertDevices() {
    await connectDB();
    const col = collections().devices;
    let created = 0, updated = 0, skipped = 0;

    for (const d of devices) {
        // Ensure uniqueness on deviceId and macId; upsert if exists
        const existing = await col.findOne({ $or: [{ deviceId: d.deviceId }, { macId: d.macId }] });
        if (!existing) {
            await col.insertOne({ ...d });
            created++;
            logger.loggerSuccess(`Created device ${d.deviceId}`);
        } else {
            await col.updateOne(
                { _id: existing._id },
                { $set: { deviceId: d.deviceId, batteryId: d.batteryId, macId: d.macId, status: true } }
            );
            updated++;
            logger.loggerInfo(`Updated device ${d.deviceId}`);
        }
    }

    return { created, updated, skipped };
}

upsertDevices()
    .then(({ created, updated }) => {
        console.log(JSON.stringify({ ok: true, created, updated }));
        process.exit(0);
    })
    .catch((err) => {
        console.error('Seeding error:', err?.message || err);
        process.exit(1);
    });