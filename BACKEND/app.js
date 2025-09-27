import http from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import devicesRoutes from './routes/devices.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import telemetryRoutes from './routes/telemetry.routes.js';
import dataRoutes from './routes/data.routes.js';
import { setupWebSocket, broadcast } from './Websocket/hub.js';
import logger from './utils/logger.js';
import responseFormatter from './middlewares/response.js';
import Device from './data/Device.model.js';
import Telemetry from './data/Telemetry.model.js';

// Load environment variables dynamically based on NODE_ENV
const env = process.env.NODE_ENV || 'production';
dotenv.config({ path: `.env.${env}` });
// Fallback to default .env if not found
dotenv.config();

// Ports (can be overridden via env)
const API_PORT = Number(process.env.PORT_API || process.env.PORT || 8070); // frontend/API
const WS_PORT = Number(process.env.PORT_WS || 8071); // WebSocket
const INGEST_PORT = Number(process.env.PORT_INGEST || 8072); // device ingestion

// Common middlewares
function applyCommonMiddleware(app) {
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));
    app.use(morgan('dev', { stream: { write: (message) => logger.loggerInfo(message.trim()) } }));
    app.use(responseFormatter);
}

// API server (for frontend)
const apiApp = express();
applyCommonMiddleware(apiApp);
apiApp.get('/health', (_req, res) => {
    res.ok({ status: 'ok', env, services: { api: API_PORT, ws: WS_PORT, ingest: INGEST_PORT } }, 'Health');
});
apiApp.get('/docs', (_req, res) => {
    res.ok({
        name: 'BMS API',
        env,
        routes: {
            health: '/health',
            docs: '/docs',
            devices: {
                base: '/devices',
                create: 'POST /devices/create',
                list: 'GET /devices/fetch-all?includeInactive=true|false',
                get: 'GET /devices/:di',
                update: 'PUT /devices/update/:di',
                status: 'PATCH /devices/:di/status',
                delete: 'DELETE /devices/delete/:di',
            },
            notifications: {
                base: '/notifications',
                upsert: 'POST /notifications/mapping/upsert',
                list: 'GET /notifications/mapping/fetch-all',
                get: 'GET /notifications/mapping/:di',
                update: 'PUT /notifications/mapping/update/:di',
                delete: 'DELETE /notifications/mapping/delete/:di',
            },
            analytics: {
                summary: 'GET /analytics/summary?di=&from=&to=',
            },
            telemetry: {
                latest: 'GET /telemetry/latest?di=',
                range: 'GET /telemetry/range?di=&from=&to=&limit=',
            },
            ingest: {
                health: `GET http://host:${INGEST_PORT}/health`,
                post: `POST http://host:${INGEST_PORT}/data`,
            },
            websocket: {
                port: WS_PORT,
                note: 'Connect using WS protocol',
            },
        },
    }, 'Docs');
});
apiApp.use('/devices', devicesRoutes);
apiApp.use('/notifications', notificationsRoutes);
apiApp.use('/analytics', analyticsRoutes);
apiApp.use('/telemetry', telemetryRoutes);

// Ingestion server (for devices)
const ingestApp = express();
applyCommonMiddleware(ingestApp);
// Keep path as /data so devices POST to http://host:INGEST_PORT/data
ingestApp.use('/data', dataRoutes);
ingestApp.get('/health', (_req, res) => {
    res.ok({ status: 'ok', role: 'ingest', env }, 'Health');
});

async function start() {
    await connectDB();

    // API HTTP server
    const apiServer = http.createServer(apiApp);
    apiServer.listen(API_PORT, () => {
        logger.loggerSuccess(`API listening on ${API_PORT} [env=${env}]`);
    });

    // Ingestion HTTP server
    const ingestServer = http.createServer(ingestApp);
    ingestServer.listen(INGEST_PORT, () => {
        logger.loggerSuccess(`Ingestion listening on ${INGEST_PORT} [env=${env}]`);
    });

    // WebSocket server (standalone port)
    const wsServer = http.createServer();
    setupWebSocket(wsServer);
    wsServer.listen(WS_PORT, () => {
        logger.loggerSuccess(`WebSocket listening on ${WS_PORT} [env=${env}]`);
    });

    // Periodic check for disconnected devices
    setInterval(async () => {
        try {
            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
            // Find devices that are connected but have no telemetry in last 5 minutes
            const disconnectedDevices = await Device.find({ connected: true });
            for (const device of disconnectedDevices) {
                const lastTelemetries = await Telemetry.collection.find({ 'deviceFull.deviceId': device.deviceId })
                    .sort({ timestamp: -1 })
                    .limit(1)
                    .toArray();
                const lastTelemetry = lastTelemetries[0];
                if (!lastTelemetry || lastTelemetry.timestamp < fiveMinutesAgo) {
                    await Device.findOneAndUpdate({ deviceId: device.deviceId }, { connected: false });
                    broadcast({ type: 'device_disconnected', deviceId: device.deviceId }, device.deviceId);
                    logger.loggerInfo(`Device ${device.deviceId} disconnected`);
                }
            }
        } catch (err) {
            logger.loggerError(`Disconnected check error: ${err.message || err}`);
        }
    }, 5 * 60 * 1000); // Every 5 minutes
}

start().catch((err) => {
    logger.loggerError(`Failed to start servers: ${err.message || err}`);
    process.exit(1);
});