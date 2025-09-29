import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

// Load environment variables dynamically based on NODE_ENV
const env = process.env.NODE_ENV || 'production';
dotenv.config({ path: `.env.${env}` });
// Fallback to default .env if the env-specific file isn't present
dotenv.config();

let client;
let db;

export async function connectDB() {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/BMS';
    try {
        client = new MongoClient(uri, {
            maxPoolSize: 20,
            serverSelectionTimeoutMS: 10000,
        });
        await client.connect();
        db = client.db();
        logger.loggerSuccess('MongoDB connected (native driver)');

        // Ensure time-series collection exists
        const collections = await db.listCollections({ name: 'battery_data' }).toArray();
        if (collections.length === 0) {
            await db.createCollection('battery_data', {
                timeseries: {
                    timeField: 'timestamp',
                    metaField: 'device',
                    granularity: 'seconds',
                },
                expireAfterSeconds: undefined,
            });
            await db.collection('battery_data').createIndex({ 'device.DI': 1, timestamp: -1 });
            logger.loggerInfo('Created time-series collection battery_data');
        }

        const cycleCollections = await db.listCollections({ name: 'telemetry_cycles' }).toArray();
        if (cycleCollections.length === 0) {
            await db.createCollection('telemetry_cycles');
            logger.loggerInfo('Created collection telemetry_cycles');
        }

        // Ensure indexes for performance & uniqueness
        await db.collection('devices').createIndex({ deviceId: 1 }, { unique: true, sparse: true });
        await db.collection('devices').createIndex({ macId: 1 }, { unique: true, sparse: true });
        await db.collection('devices').createIndex({ status: 1 });
        await db.collection('battery_data').createIndex({ 'deviceFull.deviceId': 1, timestamp: -1 });
        await db.collection('telemetry_cycles').createIndex({ deviceId: 1, startTimestamp: -1 });
        await db.collection('telemetry_cycles').createIndex({ deviceId: 1, state: 1 });
    } catch (err) {
        logger.loggerError(`MongoDB connection error: ${err.message || err}`);
        throw err;
    }
}

export function getDb() {
    if (!db) throw new Error('Database not initialized. Call connectDB() first.');
    return db;
}

export function collections() {
    const d = getDb();
    return {
        telemetry: d.collection('battery_data'),
        telemetryCycles: d.collection('telemetry_cycles'),
        devices: d.collection('devices'),
        notifications: d.collection('notifications'),
    };
}

export async function closeDB() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        logger.loggerInfo('MongoDB connection closed');
    }
}