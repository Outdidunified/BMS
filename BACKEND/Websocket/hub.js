import { WebSocketServer } from 'ws';
import logger from '../utils/logger.js';

let wss;
const deviceState = new Map();

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
        ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }));
        logger.loggerInfo('WebSocket client connected');
    });
    logger.loggerInfo('WebSocket server ready');
}

function broadcast(payload) {
    if (!wss) return;
    const message = JSON.stringify(payload);
    for (const client of wss.clients) if (client.readyState === 1) client.send(message);
}

export function handleIncomingFrame(doc) {
    const di = doc.device?.DI || doc.deviceFull?.deviceId;
    if (!di) return;
    const now = Date.now();
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
        broadcast({ type: 'live', aggregated: state.smallChangeStartAt != null, data: doc });
        state.smallChangeStartAt = null;
    }

    deviceState.set(di, state);
} 