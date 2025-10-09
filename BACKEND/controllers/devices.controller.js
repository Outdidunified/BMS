import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import Device from '../data/Device.model.js';
import User from '../data/User.model.js';
import StationAssignment from '../data/StationAssignment.model.js';
import DeviceAssignment from '../data/DeviceAssignment.model.js';
import logger from '../utils/logger.js';

const SUPER_ADMIN_ROLE_NAME = 'superadmin';
const SUPER_ADMIN_ROLE_ID = 1;

function isSuperAdmin(user) {
    if (!user) return false;

    if (user.role === SUPER_ADMIN_ROLE_NAME) {
        return true;
    }

    if (user.role_id === SUPER_ADMIN_ROLE_ID) {
        return true;
    }

    if (typeof user.role_id === 'string' && user.role_id.trim() === String(SUPER_ADMIN_ROLE_ID)) {
        return true;
    }

    return false;
}

async function resolveStationScope(user) {
    if (!user) {
        return [];
    }

    const scope = new Set();

    if (user.station_id) {
        scope.add(user.station_id.toString());
    }

    if (Array.isArray(user.stations)) {
        user.stations
            .filter(Boolean)
            .forEach(stationRef => scope.add(stationRef.toString()));
    }

    let userObjectId = null;

    if (user._id) {
        try {
            userObjectId = user._id instanceof ObjectId ? user._id : new ObjectId(user._id);
        } catch (error) {
            logger.loggerWarn(`resolveStationScope could not normalize user._id=${user._id}`);
        }
    }

    if (!userObjectId) {
        return Array.from(scope);
    }

    try {
        const db = getDb();
        const assignmentModel = new StationAssignment(db);
        const assignments = await assignmentModel.listByUser(userObjectId, { includeInactive: false });

        assignments.forEach(assignment => {
            if (assignment?.stationId) {
                scope.add(assignment.stationId.toString());
            }
        });
    } catch (error) {
        logger.loggerError(`resolveStationScope assignment lookup failed: ${error.message || error}`);
    }

    return Array.from(scope);
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
        const baseFilter = includeInactive ? {} : { $or: [{ status: true }, { status: { $exists: false } }] };

        let devicesFilter = baseFilter;

        if (!isSuperAdmin(req.user)) {
            const stationScope = await resolveStationScope(req.user);

            if (!stationScope.length) {
                logger.loggerInfo(`listDevices restricted: no station scope for user ${req.user?.user_id || req.user?._id}`);
                return res.ok([], 'Devices');
            }

            // Note: station_id in devices collection is stored as string, not ObjectId
            // So we need to query with both string and ObjectId formats for compatibility
            const normalizedStationScope = stationScope
                .map(stationId => {
                    try {
                        // Return both string and ObjectId versions
                        const stationIdStr = stationId instanceof ObjectId ? stationId.toString() : stationId;
                        const stationIdObj = stationId instanceof ObjectId ? stationId : new ObjectId(stationId);
                        return [stationIdStr, stationIdObj];
                    } catch (error) {
                        logger.loggerWarn(`listDevices scope contains invalid stationId=${stationId}`);
                        return null;
                    }
                })
                .filter(Boolean)
                .flat();

            devicesFilter = {
                ...baseFilter,
                station_id: { $in: normalizedStationScope },
            };
        }

        const devices = await Device.find(devicesFilter);

        logger.loggerInfo(`Devices listed count=${devices.length} includeInactive=${includeInactive} role=${req.user?.role}`);
        return res.ok(devices, 'Devices');
    } catch (err) {
        logger.loggerError(`listDevices error: ${err.message || err}`);
        res.status(500).json({ error: 'failed to list devices' });
    }
}

export async function getDevice(req, res) {
    try {
        const diParam = String(req.params.di || '').trim();

        const baseFilter = { $or: [{ deviceId: diParam }, { DI: diParam }] };

        let device;

        if (!isSuperAdmin(req.user)) {
            const stationScope = await resolveStationScope(req.user);

            if (!stationScope.length) {
                return res.fail('Device not found', 404);
            }

            // Note: station_id in devices collection is stored as string, not ObjectId
            // So we need to query with both string and ObjectId formats for compatibility
            const normalizedStationScope = stationScope
                .map(stationId => {
                    try {
                        // Return both string and ObjectId versions
                        const stationIdStr = stationId instanceof ObjectId ? stationId.toString() : stationId;
                        const stationIdObj = stationId instanceof ObjectId ? stationId : new ObjectId(stationId);
                        return [stationIdStr, stationIdObj];
                    } catch (error) {
                        logger.loggerWarn(`getDevice scope contains invalid stationId=${stationId}`);
                        return null;
                    }
                })
                .filter(Boolean)
                .flat();

            device = await Device.findOne({
                ...baseFilter,
                station_id: { $in: normalizedStationScope },
            });
        } else {
            device = await Device.findOne(baseFilter);
        }

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

export async function assignDeviceToUser(req, res) {
    try {
        if (!isSuperAdmin(req.user)) {
            return res.fail('Only superadmin can assign devices to users', 403);
        }

        const { deviceId } = req.params;
        const { userId } = req.body || {};

        if (!deviceId) {
            return res.fail('deviceId is required', 400);
        }

        if (!userId) {
            return res.fail('userId is required', 400);
        }

        const db = getDb();
        const userModel = new User(db);
        const deviceAssignmentModel = new DeviceAssignment(db);

        // Verify device exists
        const device = await Device.findOne({ deviceId });
        if (!device) {
            return res.fail('Device not found', 404);
        }

        // Verify user exists
        const user = await userModel.findById(userId);
        if (!user) {
            return res.fail('User not found', 404);
        }

        // Check if device is already assigned to another user
        const existingDeviceAssignment = await deviceAssignmentModel.findActiveAssignmentByDevice(deviceId);
        if (existingDeviceAssignment && existingDeviceAssignment.userId.toString() !== user._id.toString()) {
            return res.fail('Device is already assigned to another user', 409);
        }

        // Check if user already has this device assigned
        const existingUserAssignment = await deviceAssignmentModel.findActiveAssignment(user._id, deviceId);
        if (existingUserAssignment) {
            return res.fail('User already has this device assigned', 409);
        }

        // Check if user already has a device assigned (only one device per user)
        const currentUserDevice = await deviceAssignmentModel.findActiveAssignmentByUser(user._id);
        if (currentUserDevice) {
            return res.fail('User already has a device assigned. Please unassign the current device first.', 409);
        }

        // Create device assignment
        const assignment = await deviceAssignmentModel.createAssignment({
            userId: user._id,
            deviceId: deviceId,
            assignedAt: new Date(),
        });

        // Update user with device reference
        await userModel.collection.updateOne(
            { _id: user._id },
            {
                $set: {
                    device_id: deviceId,
                    assigned_device_id: deviceId,
                    updatedAt: new Date(),
                },
            }
        );

        // Update device with user reference
        await Device.findOneAndUpdate(
            { deviceId },
            { user_id: user._id },
            { new: true }
        );

        const updatedUser = await userModel.findById(user._id);

        logger.loggerInfo(`Device ${deviceId} assigned to user ${updatedUser.user_id || updatedUser._id.toString()}`);

        res.ok(
            {
                assignment: {
                    id: assignment._id.toString(),
                    userId: assignment.userId.toString(),
                    deviceId: assignment.deviceId,
                    assignedAt: assignment.assignedAt,
                },
                user: {
                    id: updatedUser._id.toString(),
                    user_id: updatedUser.user_id,
                    device_id: updatedUser.device_id,
                    assigned_device_id: updatedUser.assigned_device_id,
                },
            },
            'Device assigned to user successfully'
        );
    } catch (error) {
        logger.loggerError(`Assign device to user error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
}

export async function unassignDeviceFromUser(req, res) {
    try {
        if (!isSuperAdmin(req.user)) {
            return res.fail('Only superadmin can unassign devices from users', 403);
        }

        const { deviceId } = req.params;
        const { userId } = req.body || {};

        if (!deviceId) {
            return res.fail('deviceId is required', 400);
        }

        if (!userId) {
            return res.fail('userId is required', 400);
        }

        const db = getDb();
        const userModel = new User(db);
        const deviceAssignmentModel = new DeviceAssignment(db);

        // Verify device exists
        const device = await Device.findOne({ deviceId });
        if (!device) {
            return res.fail('Device not found', 404);
        }

        // Verify user exists
        const user = await userModel.findById(userId);
        if (!user) {
            return res.fail('User not found', 404);
        }

        // Check if assignment exists
        const existingAssignment = await deviceAssignmentModel.findActiveAssignment(user._id, deviceId);
        if (!existingAssignment) {
            return res.fail('Device is not assigned to this user', 404);
        }

        // Close the assignment
        const closedAssignment = await deviceAssignmentModel.closeAssignment(existingAssignment._id);
        if (!closedAssignment) {
            return res.fail('Failed to unassign device', 500);
        }

        // Update user - remove device reference
        await userModel.collection.updateOne(
            { _id: user._id },
            {
                $set: {
                    updatedAt: new Date(),
                },
                $unset: {
                    device_id: '',
                    assigned_device_id: '',
                },
            }
        );

        // Update device - remove user reference
        await Device.findOneAndUpdate(
            { deviceId },
            { $unset: { user_id: '' } },
            { new: true }
        );

        const updatedUser = await userModel.findById(user._id);

        logger.loggerInfo(`Device ${deviceId} unassigned from user ${updatedUser.user_id || updatedUser._id.toString()}`);

        res.ok(
            {
                assignment: {
                    id: closedAssignment._id.toString(),
                    userId: closedAssignment.userId.toString(),
                    deviceId: closedAssignment.deviceId,
                    assignedAt: closedAssignment.assignedAt,
                    unassignedAt: closedAssignment.unassignedAt,
                },
                user: {
                    id: updatedUser._id.toString(),
                    user_id: updatedUser.user_id,
                    device_id: updatedUser.device_id || null,
                    assigned_device_id: updatedUser.assigned_device_id || null,
                },
            },
            'Device unassigned from user successfully'
        );
    } catch (error) {
        logger.loggerError(`Unassign device from user error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
}