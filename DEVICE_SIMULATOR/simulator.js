import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { loggerInfo, loggerError, loggerWarn, loggerSuccess } from './utils/logger.js';

// Load env from the simulator's directory to avoid CWD issues
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Ingest config
const INGEST_HOST = process.env.INGEST_HOST || 'http://127.0.0.1';
const INGEST_PORT = Number(process.env.INGEST_PORT || 8072);
const INGEST_PATH = process.env.INGEST_PATH || '/data';
const API_KEY = process.env.API_KEY || '';

// Single-device fallback identifiers
const DI_ENV = process.env.DI || 'BMS001';
const BI_ENV = process.env.BI || 'BAT1001';
const MI_ENV = process.env.MI || '02:00:00:00:00:01';

// Multi-device configuration
const NUM_DEVICES = Math.max(1, Number(process.env.NUM_DEVICES || 1));
const START_INDEX = Math.max(1, Number(process.env.START_INDEX || 1));
const DI_PREFIX = process.env.DI_PREFIX || 'BMS';
const BI_PREFIX = process.env.BI_PREFIX || 'BAT';
const DEVICES_JSON = process.env.DEVICES_JSON || '';
const DEVICES_CSV = process.env.DEVICES_CSV || '';

// Timing config
const FPS = Number(process.env.FPS || 4);
const INTERVAL_MS_ENV = Number(process.env.INTERVAL_MS || 0); // optional fixed interval override
const JITTER_MS = Number(process.env.JITTER_MS || 20);
const STAGGER_MS = Number(process.env.STAGGER_MS || 200); // stagger start per device

// Behavior tuning
const NUM_CELLS = Math.max(1, Number(process.env.NUM_CELLS || 24));
const MAX_TEMP = Number(process.env.MAX_TEMP || 45); // upper clamp for base temp
const MIN_TEMP = Number(process.env.MIN_TEMP || 25);

const ONCE = process.argv.includes('--once');

function randBetween(min, max) {
    return Math.random() * (max - min) + min;
}
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
function pad(n, len = 3) {
    return String(n).padStart(len, '0');
}
function makeMacFromIndex(idx) {
    // Locally administered MAC starting with 02:00:xx:xx:xx:xx
    const a = 0x02; // locally administered unicast
    const b = 0x00;
    const c = (idx >> 16) & 0xff;
    const d = (idx >> 8) & 0xff;
    const e = idx & 0xff;
    const f = Math.floor(Math.random() * 256);
    return [a, b, c, d, e, f].map(x => x.toString(16).padStart(2, '0')).join(':');
}

// Parse device list from env
function parseDevicesFromEnv() {
    // Highest priority: DEVICES_JSON (JSON array of { DI, BI, MI })
    if (DEVICES_JSON) {
        try {
            const arr = JSON.parse(DEVICES_JSON);
            const clean = (arr || [])
                .filter(d => d && (d.DI || d.deviceId))
                .map((d, i) => ({
                    DI: d.DI || d.deviceId,
                    BI: d.BI || d.batteryId || `${BI_PREFIX}${pad(START_INDEX + i + 1000)}`,
                    MI: d.MI || d.macId || makeMacFromIndex(START_INDEX + i)
                }));
            if (clean.length) return clean;
        } catch (e) {
            loggerWarn(`DEVICES_JSON parse failed: ${e.message}`);
        }
    }
    // Next: DEVICES_CSV; format: "DI,BI,MI;DI,BI,MI;..." (MI optional)
    if (DEVICES_CSV) {
        try {
            const parts = DEVICES_CSV.split(';').map(s => s.trim()).filter(Boolean);
            const clean = parts.map((p, i) => {
                const [DI, BI, MI] = p.split(',').map(s => (s || '').trim());
                return {
                    DI: DI || `${DI_PREFIX}${pad(START_INDEX + i)}`,
                    BI: BI || `${BI_PREFIX}${pad(START_INDEX + i + 1000)}`,
                    MI: MI || makeMacFromIndex(START_INDEX + i)
                };
            });
            if (clean.length) return clean;
        } catch (e) {
            loggerWarn(`DEVICES_CSV parse failed: ${e.message}`);
        }
    }
    // If NUM_DEVICES > 1, synthesize a list; else fallback to single env device
    if (NUM_DEVICES > 1) {
        return Array.from({ length: NUM_DEVICES }, (_, i) => ({
            DI: `${DI_PREFIX}${pad(START_INDEX + i)}`,
            BI: `${BI_PREFIX}${pad(START_INDEX + i + 1000)}`,
            MI: makeMacFromIndex(START_INDEX + i)
        }));
    }
    return [{ DI: DI_ENV, BI: BI_ENV, MI: MI_ENV }];
}

class DeviceSim {
    constructor(ident) {
        this.ident = ident; // {DI, BI, MI}
        // State variables for smooth, realistic dynamics per device
        this.soc = 0.55 + randBetween(-0.08, 0.08); // 47–63%
        this.mode = 'idle'; // 'charge' | 'discharge' | 'idle'
        this.baseTemp = MIN_TEMP + randBetween(0, 6);
        this.cellVoltages = Array.from({ length: NUM_CELLS }, () => 3.62 + randBetween(-0.03, 0.03));
        this.lastModeSwitch = Date.now();
        this.nextModeIntervalMs = 15000 + Math.floor(randBetween(5000, 25000));
    }

    maybeSwitchMode() {
        const now = Date.now();
        if (now - this.lastModeSwitch >= this.nextModeIntervalMs) {
            const modes = ['charge', 'discharge', 'idle'];
            const candidates = modes.filter(m => m !== this.mode);
            this.mode = candidates[Math.floor(Math.random() * candidates.length)];
            this.lastModeSwitch = now;
            this.nextModeIntervalMs = 15000 + Math.floor(randBetween(5000, 35000));
        }
    }

    makeFrame() {
        this.maybeSwitchMode();

        // Determine currents based on mode (mutually exclusive cc/dc)
        let cc = 0, dc = 0, lc = 0;
        if (this.mode === 'charge') {
            // Higher charge current when SOC < 80%, taper near full
            const chargeCap = this.soc < 0.8 ? 4.5 : 2.2;
            cc = Number(randBetween(1.6, chargeCap).toFixed(2));
            lc = Number(randBetween(0.0, 0.3).toFixed(2));
        } else if (this.mode === 'discharge') {
            // Discharge current a bit stronger when SOC high
            const base = this.soc > 0.5 ? 1.4 : 0.8;
            dc = Number(randBetween(base, 5.0).toFixed(2));
            // Load tracks discharge current with small variance
            lc = Number(clamp(dc + randBetween(-0.25, 0.35), 0, 6).toFixed(2));
        } else {
            // Idle: tiny leakage/noise currents
            lc = Number(randBetween(0.0, 0.2).toFixed(2));
        }

        // Update SOC based on net current (simplified dynamics)
        const netI = cc - dc; // positive when charging
        const socRate = this.mode === 'idle' ? 0.00001 : 0.00005; // slow drift on idle
        const dSoc = netI * socRate;
        // Ensure SOC moves toward bounds slowly, so we see increasing/decreasing trends
        this.soc = clamp(this.soc + dSoc, 0.05, 0.99);

        // Temperature dynamics: slight drift + heating with |current|
        const tempDrift = (Math.abs(netI) * 0.02) + randBetween(-0.02, 0.03);
        this.baseTemp = clamp(this.baseTemp + tempDrift, MIN_TEMP, MAX_TEMP);

        // Cell voltage dynamics: OCV + internal resistance + noise
        const ocvBase = 3.0 + 1.2 * this.soc; // rough Li-ion approximation
        const Rcell = 0.005; // ohm per cell
        const ir = Rcell * Math.abs(netI); // IR effect per cell

        for (let i = 0; i < NUM_CELLS; i++) {
            // Target moves toward OCV +/- IR, with slight per-cell variance
            const variance = randBetween(-0.015, 0.015);
            const target = ocvBase + (netI >= 0 ? +Math.abs(ir) : -Math.abs(ir)) + variance;
            // Smoothly approach target with a touch of noise for stability
            const noise = randBetween(-0.008, 0.008);
            this.cellVoltages[i] = clamp(this.cellVoltages[i] * 0.985 + (target + noise) * 0.015, 2.8, 4.25);
        }

        // Mild balancing during charge (reduce outliers gently)
        if (this.mode === 'charge') {
            const meanV = this.cellVoltages.reduce((a, b) => a + b, 0) / NUM_CELLS;
            for (let i = 0; i < NUM_CELLS; i++) {
                if (this.cellVoltages[i] > meanV + 0.02) {
                    this.cellVoltages[i] = clamp(this.cellVoltages[i] - 0.003, 2.8, 4.25);
                }
            }
        }

        // Assemble legacy params v1..vN and temperatures T1..T25
        const params = {};
        for (let i = 1; i <= NUM_CELLS; i++) {
            params[`v${i}`] = Number(this.cellVoltages[i - 1].toFixed(2));
        }
        params.pv = Number(this.cellVoltages.reduce((sum, v) => sum + v, 0).toFixed(2));

        params.cc = Number(cc.toFixed(2));
        params.dc = Number(dc.toFixed(2));
        params.lc = Number(lc.toFixed(2));

        const tempSensors = 25;
        const temperatureArray = [];
        for (let i = 1; i <= tempSensors; i++) {
            const value = Number((this.baseTemp + randBetween(-0.4, 0.6)).toFixed(2));
            params[`T${i}`] = value;
            temperatureArray.push(value);
        }

        const health = {
            isCharging: this.mode === 'charge',
            faultCode: null,
            soc: Number((this.soc * 100).toFixed(2)),
            soh: Number(randBetween(92, 98).toFixed(2)),
        };

        const currents = {
            charging: params.cc,
            discharging: params.dc,
            load: params.lc,
        };

        const telemetry = {
            voltages: [...this.cellVoltages.map(v => Number(v.toFixed(3)))],
            temperatures: temperatureArray,
            packVoltage: params.pv,
            currents,
        };

        const frame = {
            DI: this.ident.DI,
            BI: this.ident.BI,
            MI: this.ident.MI,
            time: new Date().toISOString(),
            params,
            telemetry,
            frameSequence: this.frameSequence = (this.frameSequence || 0) + 1,
            uptimeSeconds: Math.floor(process.uptime()),
            firmwareVersion: process.env.FIRMWARE_VERSION || '1.0.0-sim',
            deviceStatus: this.mode,
            batteryState: health.isCharging ? 'charging' : (this.mode === 'discharge' ? 'discharging' : 'idle'),
            health,
            sourceTime: new Date().toISOString(),
            isCharging: health.isCharging,
            soc: health.soc,
            soh: health.soh,
        };
        return frame;
    }
}

async function sendFrame(frame) {
    const url = `${INGEST_HOST.replace(/\/$/, '')}:${INGEST_PORT}${INGEST_PATH}`;
    try {
        const headers = {};
        headers['x-api-key'] = API_KEY;
        const res = await axios.post(url, frame, { headers });
        if (res.status >= 200 && res.status < 300) {
            loggerSuccess(`Frame sent ok DI=${frame.DI}`);
        } else {
            loggerWarn(`Non-2xx response: ${res.status}`);
        }
    } catch (err) {
        loggerError(`Send error for DI=${frame.DI}: ${err?.response?.status || ''} ${err?.message}`);
    }
}

function buildDevices() {
    const list = parseDevicesFromEnv();
    if (!Array.isArray(list) || list.length === 0) {
        return [new DeviceSim({ DI: DI_ENV, BI: BI_ENV, MI: MI_ENV })];
    }
    return list.map(ident => new DeviceSim(ident));
}

async function run() {
    if (!API_KEY) {
        loggerWarn('API_KEY is not set (proceeding without it)');
    }

    const intervalMs = INTERVAL_MS_ENV > 0 ? INTERVAL_MS_ENV : Math.max(10, Math.round(1000 / Math.max(1, FPS)));
    if (INTERVAL_MS_ENV > 0) {
        loggerInfo(`Starting simulator to ${INGEST_HOST}:${INGEST_PORT}${INGEST_PATH} at fixed interval ${intervalMs}ms`);
    } else {
        loggerInfo(`Starting simulator to ${INGEST_HOST}:${INGEST_PORT}${INGEST_PATH} at ${FPS} fps (interval ~${intervalMs}ms)`);
    }

    const sims = buildDevices();
    loggerInfo(`Simulating ${sims.length} device(s)`);
    sims.forEach((s, i) => loggerInfo(`  - DI=${s.ident.DI} BI=${s.ident.BI} MI=${s.ident.MI}`));

    if (ONCE) {
        for (const sim of sims) {
            const frame = sim.makeFrame();
            await sendFrame(frame);
        }
        return;
    }

    // Schedule a loop per device with start-time staggering and per-iteration jitter
    sims.forEach((sim, idx) => {
        const startDelay = idx * STAGGER_MS;
        setTimeout(function loop() {
            const frame = sim.makeFrame();
            sendFrame(frame).finally(() => {
                const jitter = INTERVAL_MS_ENV > 0 ? 0 : Math.floor(randBetween(0, JITTER_MS));
                setTimeout(loop, intervalMs + jitter);
            });
        }, startDelay);
    });
}

run();