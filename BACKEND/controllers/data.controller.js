import Telemetry from '../data/Telemetry.model.js';
import Device from '../data/Device.model.js';
import { handleIncomingFrame, broadcast } from '../Websocket/hub.js';
import { evaluateAndSendAlerts } from '../utils/alerts.js';
import logger from '../utils/logger.js';
import telemetryCycleProcessor from '../services/telemetryCycleProcessor.js';

export async function ingestData(req, res) {
    try {
        const frame = req.body || {};
        // Normalize identifiers: prefer full-form deviceFull; fallback to legacy DI/BI/MI
        const deviceId = frame.deviceFull?.deviceId || frame.DI;
        const batteryId = frame.deviceFull?.batteryId || frame.BI;
        const macId = frame.deviceFull?.macId || frame.MI;

        logger.loggerDebug(`Ingest frame received for deviceId=${deviceId}`);

        if (!deviceId) {
            logger.loggerWarn('Ingest frame missing deviceId');
            return res.fail('missing deviceId', 400);
        }

        const lookupFilters = [{ deviceId }, { DI: deviceId }];
        if (macId) lookupFilters.push({ macId });
        if (batteryId) lookupFilters.push({ batteryId });
        const lookupQuery = lookupFilters.length > 1 ? { $or: lookupFilters } : lookupFilters[0];

        const now = new Date();
        let device;
        let wasInserted = false;
        try {
            const upsertResult = await Device.findOneAndUpdate(
                lookupQuery,
                {
                    $set: {
                        deviceId,
                        DI: deviceId,
                        batteryId,
                        macId,
                        status: true,
                        updatedAt: now,
                    },
                    $setOnInsert: {
                        createdAt: now,
                        connected: false,
                    },
                },
                { upsert: true, new: true, returnDocument: 'after', rawResult: true },
            );

            device = upsertResult?.value;
            wasInserted =
                upsertResult?.lastErrorObject?.upserted != null ||
                upsertResult?.lastErrorObject?.updatedExisting === false;

            if (!device) {
                device = await Device.findOne(lookupQuery);
            }

            if (wasInserted) {
                logger.loggerInfo(`Auto-registered device ${deviceId} from ingest`);
            } else {
                logger.loggerDebug(`Device ${deviceId} matched existing record during ingest`);
            }
        } catch (upsertErr) {
            logger.loggerError(`Device auto-registration failed for ${deviceId}: ${upsertErr?.message || upsertErr}`);
            return res.fail('device registration failed', 500);
        }

        if (!device) {
            logger.loggerError(`Device lookup returned no document for ${deviceId} after upsert`);
            return res.fail('device registration failed', 500);
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

        telemetryCycleProcessor.processDocument(doc).catch((err) => {
            logger.loggerError(`Telemetry cycle processing failed for device ${deviceId}: ${err?.message || err}`);
        });

        // Update device connected status
        if (!device.connected) {
            await Device.findOneAndUpdate({ deviceId }, { connected: true });
            broadcast({ type: 'device_connected', deviceId }, deviceId);
            logger.loggerInfo(`Device ${deviceId} connected`);
        }

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