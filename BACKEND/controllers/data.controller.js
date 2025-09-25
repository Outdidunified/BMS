import Telemetry from '../data/Telemetry.model.js';
import Device from '../data/Device.model.js';
import { handleIncomingFrame } from '../Websocket/hub.js';
import { evaluateAndSendAlerts } from '../utils/alerts.js';
import logger from '../utils/logger.js';

export async function ingestData(req, res) {
    try {
        const frame = req.body || {};
        // Normalize identifiers: prefer full-form deviceFull; fallback to legacy DI/BI/MI
        const deviceId = frame.deviceFull?.deviceId || frame.DI;
        const batteryId = frame.deviceFull?.batteryId || frame.BI;
        const macId = frame.deviceFull?.macId || frame.MI;

        logger.loggerDebug(`Ingest frame received for deviceId=${deviceId}`);

        // Authorize by deviceId (and allow legacy DI match), ignoring x-api-key
        const device = await Device.findOne({ $or: [{ deviceId }, { DI: deviceId }] });
        if (!device) {
            logger.loggerWarn(`Unknown device attempt for deviceId=${deviceId}`);
            return res.status(403).json({ error: 'unknown device' });
        }
        if (device && device.status === false) {
            logger.loggerWarn(`Inactive device blocked for deviceId=${deviceId}`);
            return res.fail('inactive device', 403);
        }

        const timestamp = frame.time ? new Date(frame.time) : new Date();
        // Build telemetry from full-form if provided; otherwise map legacy params
        const legacyParams = frame.params || {};
        const sourceTele = frame.telemetry || {};

        const voltages = Array.isArray(sourceTele.voltages)
            ? sourceTele.voltages.map(v => (typeof v === 'number' ? v : null))
            : Array.from({ length: 24 }, (_, i) => {
                const v = legacyParams[`v${i + 1}`];
                return typeof v === 'number' ? v : null;
            });
        const temperatures = Array.isArray(sourceTele.temperatures)
            ? sourceTele.temperatures.map(t => (typeof t === 'number' ? t : null))
            : Array.from({ length: 25 }, (_, i) => {
                const t = legacyParams[`T${i + 1}`];
                return typeof t === 'number' ? t : null;
            });
        const telemetryV2 = {
            voltages,
            packVoltage: typeof sourceTele.packVoltage === 'number' ? sourceTele.packVoltage : (typeof legacyParams.pv === 'number' ? legacyParams.pv : null),
            currents: {
                charging: typeof sourceTele?.currents?.charging === 'number' ? sourceTele.currents.charging : (typeof legacyParams.cc === 'number' ? legacyParams.cc : null),
                discharging: typeof sourceTele?.currents?.discharging === 'number' ? sourceTele.currents.discharging : (typeof legacyParams.dc === 'number' ? legacyParams.dc : null),
                load: typeof sourceTele?.currents?.load === 'number' ? sourceTele.currents.load : (typeof legacyParams.lc === 'number' ? legacyParams.lc : null),
            },
            temperatures,
        };

        const doc = {
            timestamp,
            // Store only full-form identifiers and telemetry
            deviceFull: { deviceId, batteryId, macId },
            telemetry: telemetryV2,
        };

        await Telemetry.collection.insertOne(doc);
        handleIncomingFrame(doc);
        evaluateAndSendAlerts(
            // Create a minimal device object for alerts with DI compatibility
            { ...device, DI: device.deviceId || device.DI },
            // Provide a legacy facade for downstream consumers while we transition
            { ...doc, device: { DI: deviceId, BI: batteryId, MI: macId }, params: legacyParams }
        ).catch((e) => logger.loggerError(`Alert evaluation error: ${e?.message || e}`));

        res.json({ ok: true });
    } catch (err) {
        logger.loggerError(`data error: ${err.message || err}`);
        return res.fail('Invalid payload', 400);
    }
}