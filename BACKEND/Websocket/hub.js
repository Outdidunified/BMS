import { WebSocketServer } from 'ws';
import logger from '../utils/logger.js';

let wss;
const deviceState = new Map();
const connectedDevices = new Map(); // deviceId -> lastFrameTs

function isNumeric(n) { return typeof n === 'number' && Number.isFinite(n); }

function flattenNumericParamsLegacy(params = {}) {
    const out = {};
    for (const [k, v] of Object.entries(params)) if (isNumeric(v)) out[k] = v;
    return out;
}

function flattenNumericFullForm(telemetry = {}) {
    const out = {};
    const { voltages, temperatures, packVoltage, currents } = telemetry || {};
    if (Array.isArray(voltages)) voltages.forEach((v, i) => { if (isNumeric(v)) out[`v${i + 1}`] = v; });
    if (Array.isArray(temperatures)) temperatures.forEach((t, i) => { if (isNumeric(t)) out[`T${i + 1}`] = t; });
    if (isNumeric(packVoltage)) out.pv = packVoltage;
    if (currents) {
        if (isNumeric(currents.charging)) out.cc = currents.charging;
        if (isNumeric(currents.discharging)) out.dc = currents.discharging;
        if (isNumeric(currents.load)) out.lc = currents.load;
    }
    return out;
}

function percentChanged(a, b) {
    if (!isNumeric(a) || !isNumeric(b)) return true;
    if (b === 0) return a !== 0;
    return Math.abs(a - b) / Math.abs(b) >= 0.01;
}

function shouldPush(lastParams, newParams) {
    const keys = new Set([...Object.keys(lastParams || {}), ...Object.keys(newParams || {})]);
    for (const k of keys) {
        const a = newParams[k];
        const b = lastParams[k];
        if (percentChanged(a, b)) return true;
    }
    return false;
}

export function setupWebSocket(server) {
    wss = new WebSocketServer({ server });
    wss.on('connection', (ws) => {
        ws.subscriptions = new Set();
        ws.send(JSON.stringify({ type: 'hello', ts: Date.now(), devices: Array.from(connectedDevices.keys()) }));
        logger.loggerInfo('WebSocket client connected');

        ws.on('message', (data) => {
            console.log('Received WS message:', data.toString());
            try {
                const msg = JSON.parse(data.toString());
                console.log('Parsed WS message:', msg);
                if (msg.type === 'subscribe') {
                    if (connectedDevices.has(msg.deviceId)) {
                        ws.subscriptions.add(msg.deviceId);
                        logger.loggerInfo(`Client subscribed to device ${msg.deviceId}`);
                    } else {
                        logger.loggerWarn(`Client tried to subscribe to inactive device ${msg.deviceId}`);
                    }
                } else if (msg.type === 'unsubscribe') {
                    ws.subscriptions.delete(msg.deviceId);
                    logger.loggerInfo(`Client unsubscribed from device ${msg.deviceId}`);
                } else if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
                    logger.loggerPingPong(`Ping from client, sent pong`);
                }
            } catch (e) {
                logger.loggerWarn(`Invalid message from client: ${data.toString()}`);
            }
        });

        ws.on('close', (code, reason) => {
            logger.loggerInfo(`WebSocket client disconnected: code ${code}, reason ${reason}`);
        });

        ws.on('error', (error) => {
            logger.loggerError(`WebSocket error: ${error.message}`);
        });
    });
    logger.loggerInfo('WebSocket server ready');
}

export function broadcast(payload, deviceId = null) {
    if (!wss) return;
    const message = JSON.stringify(payload);
    for (const client of wss.clients) {
        if (client.readyState === 1) {
            if (deviceId === null || client.subscriptions.has(deviceId)) {
                client.send(message);
            }
        }
    }
}

export function handleIncomingFrame(doc) {
    const di = doc.device?.DI || doc.deviceFull?.deviceId;
    if (!di) return;
    const now = Date.now();
    connectedDevices.set(di, now); // Update last frame time
    const state = deviceState.get(di) || { lastPushedParams: null, lastPushedAt: 0, smallChangeStartAt: null };

    // Prefer full-form telemetry; fallback to legacy flat params for diff/broadcast
    const newParams = Object.assign({}, flattenNumericFullForm(doc.telemetry), flattenNumericParamsLegacy(doc.params));

    let pushNow = false;
    if (!state.lastPushedParams) {
        pushNow = true;
    } else if (shouldPush(state.lastPushedParams, newParams)) {
        pushNow = true;
        state.smallChangeStartAt = null;
    } else {
        if (!state.smallChangeStartAt) state.smallChangeStartAt = now;
        const fifteenMin = 15 * 60 * 1000;
        if (now - state.lastPushedAt >= fifteenMin) pushNow = true;
    }

    if (pushNow) {
        state.lastPushedParams = newParams;
        state.lastPushedAt = now;
        broadcast({ type: 'live', aggregated: state.smallChangeStartAt != null, data: doc }, di);
        state.smallChangeStartAt = null;
    }

    deviceState.set(di, state);
}

// Periodic cleanup of connectedDevices (devices not seen for 5 minutes)
setInterval(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    for (const [di, lastTs] of connectedDevices.entries()) {
        if (now - lastTs > timeout) {
            connectedDevices.delete(di);
            logger.loggerInfo(`Device ${di} removed from connected devices due to inactivity`);
        }
    }
}, 60 * 1000); // Check every minute 