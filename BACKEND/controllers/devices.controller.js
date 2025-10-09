import { ObjectId } from 'mongodb';
import Device from '../data/Device.model.js';
import logger from '../utils/logger.js';

const RESTRICTED_ROLES = new Set(['station muster role 2']);

function buildStationScope(user) {
    if (!user) {
        return [];
    }

    const assignedStations = Array.isArray(user.assigned_station_ids)
        ? user.assigned_station_ids
            .map(entry => {
                try {
                    return new ObjectId(entry.assignmentId);
                } catch (error) {
                    logger.loggerWarn(`Invalid assignmentId encountered while building station scope: ${entry?.assignmentId}`);
                    return null;
                }
            })
            .filter(Boolean)
        : [];

    const directStations = Array.isArray(user.stations)
        ? user.stations
            .map(stationId => {
                try {
                    return new ObjectId(stationId);
                } catch (error) {
                    logger.loggerWarn(`Invalid station reference encountered while building station scope: ${stationId}`);
                    return null;
                }
            })
            .filter(Boolean)
        : [];

    const scope = new Set([
        ...assignedStations.map(id => id.toString()),
        ...directStations.map(id => id.toString()),
    ]);

    if (user.station_id) {
        scope.add(user.station_id.toString());
    }

    return Array.from(scope).map(id => new ObjectId(id));
}

export async function createDevice(req, res) {
    try {
        const b = req.body || {};
        // Normalize to full-form only; stop storing legacy short fields
        const deviceId = (b.deviceId || b.DI || '').trim();
        const batteryId = (b.batteryId || b.BI || '').trim();
        const macId = (b.macId || b.MI || '').trim();

        // Basic validation
        if (!deviceId || !batteryId || !macId) {
            return res.fail('deviceId, batteryId, macId are required', 400);
        }

        // Conflict check
        const existing = await Device.findOne({ $or: [{ deviceId }, { macId }] });
        if (existing) {
            return res.fail('Device with same deviceId or macId already exists', 409);
        }

        const doc = {
            deviceId,
            batteryId,
            macId,
            batteryCapacityAh: typeof b.batteryCapacityAh === 'number' ? b.batteryCapacityAh : undefined,
            apiKey: b.apiKey,
            alerts: b.alerts || {},
            meta: b.meta || {},
            status: typeof b.status === 'boolean' ? b.status : true, // default active
            connected: false, // default disconnected
        };
        const device = await Device.create(doc);
        logger.loggerSuccess(`Device created id=${device?.deviceId} status=${device.status}`);
        return res.ok(device, 'Device created', 201);
    } catch (err) {
        // Handle duplicate key errors gracefully
        if (err && err.code === 11000) {
            logger.loggerWarn(`createDevice duplicate key: ${JSON.stringify(err.keyValue)}`);
            return res.fail('Duplicate deviceId or macId', 409);
        }
        logger.loggerError(`createDevice error: ${err.message || err}`);
        return res.fail(err.message || 'createDevice error', 400);
    }
}

export async function listDevices(req, res) {
    try {
        // By default, only return active devices (status=true). Allow override via query ?includeInactive=true
        const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
        const filter = includeInactive ? {} : { $or: [{ status: true }, { status: { $exists: false } }] };
        const devices = await Device.find(filter);
        logger.loggerInfo(`Devices listed count=${devices.length} includeInactive=${includeInactive}`);
        return res.ok(devices, 'Devices');
    } catch (err) {
        logger.loggerError(`listDevices error: ${err.message || err}`);
        res.status(500).json({ error: 'failed to list devices' });
    }
}

export async function getDevice(req, res) {
    try {
        const diParam = String(req.params.di || '').trim();
        const device = await Device.findOne({ $or: [{ deviceId: diParam }, { DI: diParam }] });
        if (!device) return res.fail('Device not found', 404);
        return res.ok(device, 'Device');
    } catch (err) {
        logger.loggerError(`getDevice error: ${err.message || err}`);
        res.status(500).json({ error: 'failed to fetch device' });
    }
}

export async function updateDevice(req, res) {
    try {
        const b = req.body || {};
        // Only update full-form fields; do not store legacy aliases
        const update = {};
        if (b.deviceId || b.DI) update.deviceId = (b.deviceId || b.DI).trim();
        if (b.batteryId || b.BI) update.batteryId = (b.batteryId || b.BI).trim();
        if (b.macId || b.MI) update.macId = (b.macId || b.MI).trim();
        if (Object.prototype.hasOwnProperty.call(b, 'apiKey')) update.apiKey = b.apiKey;
        if (Object.prototype.hasOwnProperty.call(b, 'alerts')) update.alerts = b.alerts || {};
        if (Object.prototype.hasOwnProperty.call(b, 'meta')) update.meta = b.meta || {};
        if (Object.prototype.hasOwnProperty.call(b, 'status')) update.status = !!b.status; // allow activate/deactivate

        const diParam = String(req.params.di || '').trim();
        const device = await Device.findOneAndUpdate({ $or: [{ DI: diParam }, { deviceId: diParam }] }, update, { new: true });
        if (!device) {
            logger.loggerWarn(`updateDevice not found DI=${req.params.di}`);
            return res.fail('Device not found', 404);
        }
        logger.loggerSuccess(`Device updated DI=${device.DI || device.deviceId}`);
        return res.ok(device, 'Device updated');
    } catch (err) {
        if (err && err.code === 11000) {
            logger.loggerWarn(`updateDevice duplicate key: ${JSON.stringify(err.keyValue)}`);
            return res.fail('Duplicate deviceId or macId', 409);
        }
        logger.loggerError(`updateDevice error: ${err.message || err}`);
        return res.fail(err.message || 'updateDevice error', 400);
    }
}

export async function updateDeviceStatus(req, res) {
    try {
        const { status } = req.body || {};
        if (typeof status !== 'boolean') return res.fail('status(boolean) is required', 400);
        const diParam = String(req.params.di || '').trim();
        const device = await Device.findOneAndUpdate({ $or: [{ DI: diParam }, { deviceId: diParam }] }, { status: !!status }, { new: true });
        if (!device) return res.fail('Device not found', 404);
        logger.loggerSuccess(`Device status updated DI=${diParam} -> ${status}`);
        return res.ok(device, 'Status updated');
    } catch (err) {
        logger.loggerError(`updateDeviceStatus error: ${err.message || err}`);
        return res.fail('Unable to update device status.', 400);
    }
}

export async function deleteDevice(req, res) {
    try {
        // Support deletion by DI or deviceId while storing only full-form fields
        const diParam = String(req.params.di || '').trim();
        const result = await Device.deleteOne({ $or: [{ DI: diParam }, { deviceId: diParam }] });
        if (result.deletedCount === 0) {
            logger.loggerWarn(`deleteDevice not found DI=${req.params.di}`);
            return res.fail('Device not found', 404);
        }
        logger.loggerSuccess(`Device deleted DI=${req.params.di}`);
        return res.ok({ deleted: true }, 'Device deleted');
    } catch (err) {
        logger.loggerError(`deleteDevice error: ${err.message || err}`);
        res.status(400).json({ error: err.message });
    }
}