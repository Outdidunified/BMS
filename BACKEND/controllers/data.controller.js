import Telemetry from '../data/Telemetry.model.js';
import Device from '../data/Device.model.js';
import { handleIncomingFrame, broadcast } from '../Websocket/hub.js';
import { evaluateAndSendAlerts } from '../utils/alerts.js';
import logger from '../utils/logger.js';
import telemetryCycleProcessor from '../services/telemetryCycleProcessor.js';
import telemetryBatcher from '../services/telemetryBatcher.js';

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
            const fieldsToSet = {
                deviceId,
                DI: deviceId,
                status: true,
                updatedAt: now,
            };

            if (batteryId) {
                fieldsToSet.batteryId = batteryId;
            }

            if (macId) {
                fieldsToSet.macId = macId;
            }

            const updateOperators = {
                $set: fieldsToSet,
                $setOnInsert: {
                    createdAt: now,
                    connected: false,
                },
            };

            if (!macId) {
                updateOperators.$unset = { ...(updateOperators.$unset || {}), macId: "" };
            }

            if (!batteryId) {
                updateOperators.$unset = { ...(updateOperators.$unset || {}), batteryId: "" };
            }

            const upsertResult = await Device.findOneAndUpdate(
                lookupQuery,
                updateOperators,
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

        const legacyParamsOriginal = frame.params || {};
        const legacyParams = { ...legacyParamsOriginal };
        const sourceTele = frame.telemetry || {};

        const centiTemps = Array.isArray(sourceTele.temperatures)
            ? sourceTele.temperatures.some(t => typeof t === 'number' && Math.abs(t) >= 200)
            : Object.keys(legacyParams).some((key) => {
                if (!key.startsWith('T')) return false;
                const numericPart = Number(key.slice(1));
                if (!Number.isFinite(numericPart)) return false;
                const tempValue = legacyParams[key];
                return typeof tempValue === 'number' && Math.abs(tempValue) >= 200;
            });

        const stripCenti = (value) => {
            if (typeof value !== 'number') return null;
            if (!centiTemps) return value;
            return Number((value / 100).toFixed(2));
        };

        const voltages = Array.isArray(sourceTele.voltages)
            ? sourceTele.voltages.map(v => (typeof v === 'number' ? v : null))
            : Array.from({ length: 24 }, (_, i) => {
                const v = legacyParams[`v${i + 1}`];
                return typeof v === 'number' ? v : null;
            });

        const temperatures = Array.isArray(sourceTele.temperatures)
            ? sourceTele.temperatures.map(stripCenti)
            : Array.from({ length: 25 }, (_, i) => {
                const tKey = `T${i + 1}`;
                const t = legacyParams[tKey];
                const normalized = stripCenti(t);
                if (normalized != null) legacyParams[tKey] = normalized;
                return normalized;
            });

        const currentsSource = sourceTele?.currents || {};
        const currents = {
            charging: typeof currentsSource.charging === 'number' ? currentsSource.charging : (typeof legacyParams.cc === 'number' ? legacyParams.cc : null),
            discharging: typeof currentsSource.discharging === 'number' ? currentsSource.discharging : (typeof legacyParams.dc === 'number' ? legacyParams.dc : null),
            load: typeof currentsSource.load === 'number' ? currentsSource.load : (typeof legacyParams.lc === 'number' ? legacyParams.lc : null),
        };

        const telemetryMetadata = {
            firmwareVersion: frame.firmwareVersion || frame.deviceFull?.firmwareVersion || null,
            deviceStatus: frame.deviceStatus || null,
            batteryState: frame.batteryState || null,
            frameSequence: frame.frameSequence ?? null,
            uptimeSeconds: frame.uptimeSeconds ?? null,
            health: {
                isCharging: frame.isCharging ?? frame.health?.isCharging ?? null,
                faultCode: frame.faultCode ?? frame.health?.faultCode ?? null,
                soc: frame.soc ?? frame.health?.soc ?? null,
                soh: frame.soh ?? frame.health?.soh ?? null,
            },
            timestampSource: frame.sourceTime || frame.deviceTime || null,
            apiKey: req.apiKey || null,
        };

        const telemetryV2 = {
            voltages,
            packVoltage: typeof sourceTele.packVoltage === 'number' ? sourceTele.packVoltage : (typeof legacyParams.pv === 'number' ? legacyParams.pv : null),
            currents,
            temperatures,
            metadata: telemetryMetadata,
        };

        const doc = {
            timestamp,
            deviceFull: {
                deviceId,
                batteryId,
                macId,
                firmwareVersion: telemetryMetadata.firmwareVersion,
                deviceStatus: telemetryMetadata.deviceStatus,
                batteryState: telemetryMetadata.batteryState,
            },
            telemetry: telemetryV2,
            params: legacyParams,
            frameSequence: telemetryMetadata.frameSequence,
            uptimeSeconds: telemetryMetadata.uptimeSeconds,
            health: telemetryMetadata.health,
            timestampSource: telemetryMetadata.timestampSource,
            apiKey: telemetryMetadata.apiKey,
        };

        telemetryBatcher.add(doc);
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