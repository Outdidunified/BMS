import { getDb } from '../config/db.js';
import Station from '../data/Station.model.js';
import Device from '../data/Device.model.js';
import User from '../data/User.model.js';
import Role from '../data/Role.model.js';
import StationAssignment from '../data/StationAssignment.model.js';
import logger from '../utils/logger.js';
import { ObjectId } from 'mongodb';
import { collections } from '../config/db.js';

const toObjectId = value => (value instanceof ObjectId ? value : new ObjectId(value));

const buildAssignedStationEntries = assignments =>
    assignments.map(assignment => ({
        assignmentId: toObjectId(assignment.assignmentId),
        stationNumber: assignment.stationNumber,
    }));

const serializeAssignedStationEntries = entries =>
    (entries || []).map(entry => ({
        assignmentId: toObjectId(entry.assignmentId).toString(),
        stationNumber: entry.stationNumber,
    }));

export const getStations = async (req, res) => {
    try {
        const db = getDb();
        const stationModel = new Station(db);

        let stations;
        if (req.user.role === 'superadmin') {
            stations = await stationModel.findAll();
        } else if (req.user.role === 'stationmaster' && req.user.station_id) {
            const station = await stationModel.findById(req.user.station_id.toString());
            stations = station ? [station] : [];
        } else {
            return res.fail('Unauthorized', 403);
        }

        const assignmentModel = new StationAssignment(db);
        const userModel = new User(db);

        const stationAssignments = await Promise.all(
            stations.map(async station => ({
                station,
                assignments: await assignmentModel.listByStation(station._id),
            }))
        );

        const userIdStrings = [
            ...new Set(
                stationAssignments
                    .flatMap(({ assignments }) => assignments.map(assignment => assignment.userId))
                    .filter(Boolean)
                    .map(userId => userId.toString())
            ),
        ];

        let users = [];
        if (userIdStrings.length > 0) {
            const userObjectIds = userIdStrings.map(id => new ObjectId(id));
            users = await userModel.collection
                .find({ _id: { $in: userObjectIds } })
                .toArray();
        }

        const userMap = new Map(users.map(user => [user._id.toString(), user]));

        const enrichedStations = stationAssignments.map(({ station, assignments }) => ({
            ...station,
            assignments: assignments.map(assignment => {
                const userIdStr = assignment.userId ? assignment.userId.toString() : null;
                const user = userIdStr ? userMap.get(userIdStr) : null;

                return {
                    user: user
                        ? {
                            id: user._id.toString(),
                            user_id: user.user_id,
                            name: user.name,
                            email: user.email,
                        }
                        : null,
                };
            }),
        }));

        res.ok(enrichedStations, 'Stations retrieved successfully');
    } catch (error) {
        logger.loggerError(`Get stations error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const getStation = async (req, res) => {
    try {
        const { stationId } = req.params;
        const db = getDb();
        const stationModel = new Station(db);
        const assignmentModel = new StationAssignment(db);

        const station = await stationModel.findById(stationId);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        // Check permission
        if (req.user.role !== 'superadmin' && (!req.user.station_id || req.user.station_id.toString() !== stationId)) {
            return res.fail('Unauthorized', 403);
        }

        const assignments = await assignmentModel.listByStation(station._id);

        let assignedUsers = [];
        if (assignments.length > 0) {
            const userIds = [...new Set(assignments.map(a => a.userId))];
            assignedUsers = await User.find({ _id: { $in: userIds } }).lean();
        }

        const userMap = new Map(assignedUsers.map(user => [user._id.toString(), user]));

        station.assignments = assignments.map(assignment => {
            const user = userMap.get(assignment.userId.toString());
            return {
                user: user ? {
                    id: user._id.toString(),
                    user_id: user.user_id,
                    name: user.name,
                    email: user.email,
                } : null,

            };
        });
        logger.loggerInfo(`Station ${station.toString()} retrieved`);
        res.ok(station, 'Station retrieved successfully');
    } catch (error) {
        logger.loggerError(`Get station error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const createStation = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.fail('Only superadmin can create stations', 403);
        }

        const { name, location, status } = req.body;
        if (!name) {
            return res.fail('Name is required', 400);
        }

        const db = getDb();
        const stationModel = new Station(db);

        const newStation = await stationModel.create({ name, location, status: status !== undefined ? status : true });

        logger.loggerInfo(`Station ${name} created`);
        res.ok(newStation, 'Station created successfully');
    } catch (error) {
        logger.loggerError(`Create station error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const updateStation = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.fail('Only superadmin can update stations', 403);
        }

        const { stationId } = req.params;
        const { name, location, status } = req.body;

        const db = getDb();
        const stationModel = new Station(db);

        const success = await stationModel.update(stationId, { name, location, status });

        if (!success) {
            return res.fail('Station not found', 404);
        }

        logger.loggerInfo(`Station ${stationId} updated`);
        res.ok({}, 'Station updated successfully');
    } catch (error) {
        logger.loggerError(`Update station error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const deactivateStation = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.fail('Only superadmin can deactivate stations', 403);
        }

        const { stationId } = req.params;
        const { status } = req.body;

        if (status === undefined) {
            return res.fail('Status is required', 400);
        }

        const db = getDb();
        const stationModel = new Station(db);

        const updateData = { status };

        const success = await stationModel.update(stationId, updateData);

        if (!success) {
            return res.fail('Station not found', 404);
        }

        const updatedStation = await stationModel.findById(stationId);
        logger.loggerInfo(`Station ${updatedStation.name} ${status ? 'activated' : 'deactivated'}`);
        res.ok(updatedStation);
    } catch (error) {
        logger.loggerError(`Deactivate station error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const assignDeviceToStation = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.fail('Only superadmin can assign devices', 403);
        }

        const { stationId } = req.params;
        const { deviceId } = req.body;

        if (!deviceId) {
            return res.fail('Device ID is required', 400);
        }

        const db = getDb();
        const stationModel = new Station(db);

        const station = await stationModel.findById(stationId);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        const device = await Device.findOneAndUpdate({ deviceId }, { station_id: stationId }, { new: true });
        if (!device) {
            return res.fail('Device not found', 404);
        }

        const sanitizedDevices = Array.isArray(station.devices)
            ? station.devices
            : station.devices
                ? [station.devices]
                : [];

        if (!Array.isArray(station.devices)) {
            await stationModel.collection.updateOne(
                { _id: new ObjectId(stationId) },
                {
                    $set: {
                        devices: sanitizedDevices,
                        updatedAt: new Date(),
                    },
                }
            );
        }

        if (!sanitizedDevices.includes(deviceId)) {
            await stationModel.collection.updateOne(
                { _id: new ObjectId(stationId) },
                {
                    $addToSet: { devices: deviceId },
                    $set: { updatedAt: new Date() },
                }
            );
        }

        res.ok({}, 'Device assigned to station successfully');
    } catch (error) {
        logger.loggerError(`Assign device error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const unassignDeviceFromStation = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.fail('Only superadmin can unassign devices', 403);
        }

        const { stationId } = req.params;
        const { deviceId } = req.body;

        if (!deviceId) {
            return res.fail('Device ID is required', 400);
        }

        const db = getDb();
        const stationModel = new Station(db);

        const station = await stationModel.findById(stationId);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        const sanitizedDevices = Array.isArray(station.devices)
            ? station.devices
            : station.devices
                ? [station.devices]
                : [];

        if (!sanitizedDevices.includes(deviceId)) {
            return res.fail('Device is not assigned to this station', 404);
        }

        await Device.findOneAndUpdate({ deviceId, station_id: stationId }, { $unset: { station_id: '' } }, { new: true });

        await stationModel.collection.updateOne(
            { _id: new ObjectId(stationId) },
            {
                $set: { updatedAt: new Date() },
                $pull: { devices: deviceId },
            }
        );

        res.ok({}, 'Device unassigned from station successfully');
    } catch (error) {
        logger.loggerError(`Unassign device error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const assignUserToStation = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.fail('Only superadmin can assign users to stations', 403);
        }

        const { stationId } = req.params;
        const { userId, roleId, roleName } = req.body || {};

        if (!stationId || !ObjectId.isValid(stationId)) {
            return res.fail('Valid stationId is required', 400);
        }

        if (!userId) {
            return res.fail('userId is required', 400);
        }

        const db = getDb();
        const stationModel = new Station(db);
        const userModel = new User(db);
        const roleModel = new Role(db);
        const assignmentModel = new StationAssignment(db);

        const station = await stationModel.findById(stationId);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        const user = await userModel.findById(userId);
        if (!user) {
            return res.fail('User not found', 404);
        }

        const currentAssignments = await assignmentModel.listByStation(station._id);
        if (currentAssignments.some(assignment => assignment.unassignedAt === null && assignment.userId.toString() !== user._id.toString())) {
            return res.fail('Station already has an active user assigned', 409);
        }

        let resolvedRole = null;

        if (roleId !== undefined && roleId !== null) {
            resolvedRole = await roleModel.findByRoleId(roleId);
        }

        if (!resolvedRole && roleName) {
            resolvedRole = await roleModel.findByName(roleName);
        }

        if (!resolvedRole) {
            resolvedRole = await roleModel.findByName('stationmaster');
        }

        if (!resolvedRole) {
            return res.fail('Role not found', 404);
        }

        const existingAssignment = await assignmentModel.findActiveAssignment(user._id, station._id);
        if (existingAssignment) {
            return res.fail('User already assigned to this station', 409);
        }

        const assignment = await assignmentModel.createAssignment({
            userId: user._id,
            stationId: station._id,
            stationNumber: station.station_id,
            roleId: resolvedRole.role_id,
            roleName: resolvedRole.name,
        });

        const stationObjectId = new ObjectId(stationId);
        const associationEntry = {
            assignmentId: assignment._id,
            stationNumber: station.station_id,
        };

        const normalizedEntries = buildAssignedStationEntries([
            ...(Array.isArray(user.assigned_station_ids) ? user.assigned_station_ids : []),
            associationEntry,
        ]);

        await userModel.collection.updateOne(
            { _id: user._id },
            {
                $set: {
                    assigned_station_ids: normalizedEntries,
                    station_id: stationObjectId,
                    updatedAt: new Date(),
                },
                $unset: {
                    stations: '',
                },
            }
        );

        const updatedUser = await userModel.findById(user._id);

        const serializedAssignment = {
            id: assignment._id.toString(),
            userId: assignment.userId.toString(),
            stationId: assignment.stationId.toString(),
            stationNumber: assignment.stationNumber,
            roleId: assignment.roleId,
            roleName: assignment.roleName,
            assignedAt: assignment.assignedAt,
            unassignedAt: assignment.unassignedAt,
        };

        logger.loggerInfo(`User ${updatedUser.user_id || updatedUser._id.toString()} assigned to station ${stationId}`);

        res.ok(
            {
                assignment: serializedAssignment,
                user: {
                    id: updatedUser._id.toString(),
                    user_id: updatedUser.user_id,
                    assigned_station_ids: serializeAssignedStationEntries(updatedUser.assigned_station_ids),
                },
            },
            'User assigned to station successfully'
        );
    } catch (error) {
        logger.loggerError(`Assign user to station error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const unassignUserFromStation = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.fail('Only superadmin can unassign users from stations', 403);
        }

        const { stationId } = req.params;
        const { userId } = req.body || {};

        if (!stationId || !ObjectId.isValid(stationId)) {
            return res.fail('Valid stationId is required', 400);
        }

        if (!userId) {
            return res.fail('userId is required', 400);
        }

        const db = getDb();
        const stationModel = new Station(db);
        const userModel = new User(db);
        const assignmentModel = new StationAssignment(db);

        const station = await stationModel.findById(stationId);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        const user = await userModel.findById(userId);
        if (!user) {
            return res.fail('User not found', 404);
        }

        const existingAssignment = await assignmentModel.findActiveAssignment(user._id, station._id);
        if (!existingAssignment) {
            return res.fail('User is not assigned to this station', 404);
        }

        const closedAssignment = await assignmentModel.closeAssignment(existingAssignment._id);
        if (!closedAssignment) {
            return res.fail('Failed to unassign user', 500);
        }

        const stationObjectId = new ObjectId(stationId);

        const currentEntries = Array.isArray(user.assigned_station_ids) ? user.assigned_station_ids : [];
        const filteredEntries = currentEntries.filter(entry => entry.stationNumber !== station.station_id);

        await userModel.collection.updateOne(
            { _id: user._id },
            {
                $set: {
                    assigned_station_ids: filteredEntries,
                    updatedAt: new Date(),
                },
            }
        );

        const remainingAssignments = await assignmentModel.listByUser(user._id, { includeInactive: false });
        const hasOtherStations = remainingAssignments.some(assignment => assignment.stationId.toString() !== stationId);

        if (!hasOtherStations) {
            await userModel.collection.updateOne(
                { _id: user._id },
                {
                    $unset: {
                        station_id: '',
                    },
                }
            );
        }

        const updatedUser = await userModel.findById(user._id);

        logger.loggerInfo(`User ${updatedUser.user_id || updatedUser._id.toString()} unassigned from station ${stationId}`);

        res.ok(
            {
                assignment: {
                    id: closedAssignment._id.toString(),
                    userId: closedAssignment.userId.toString(),
                    stationId: closedAssignment.stationId.toString(),
                    stationNumber: closedAssignment.stationNumber,
                    roleId: closedAssignment.roleId,
                    roleName: closedAssignment.roleName,
                    assignedAt: closedAssignment.assignedAt,
                    unassignedAt: closedAssignment.unassignedAt,
                },
                user: {
                    id: updatedUser._id.toString(),
                    user_id: updatedUser.user_id,
                    assigned_station_ids: serializeAssignedStationEntries(updatedUser.assigned_station_ids),
                },
            },
            'User unassigned from station successfully'
        );
    } catch (error) {
        logger.loggerError(`Unassign user from station error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const getStationDevices = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();
        const stationModel = new Station(db);

        const station = await stationModel.findById(id);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        // Check permission
        if (req.user.role !== 'superadmin' && (!req.user.station_id || req.user.station_id.toString() !== id)) {
            return res.fail('Unauthorized', 403);
        }

        const devices = await Device.find({ station_id: id });

        // Normalize the response to a single object when stored as such
        if (station.devices && !Array.isArray(station.devices)) {
            return res.ok(station.devices, 'Device retrieved successfully');
        }

        res.ok(devices, 'Devices retrieved successfully');
    } catch (error) {
        logger.loggerError(`Get station devices error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const getUnassignedSummary = async (req, res) => {
    try {
        const db = getDb();
        const userModel = new User(db);
        const stationModel = new Station(db);
        const assignmentModel = new StationAssignment(db);

        // Devices with no station assignment
        const unassignedDevices = await Device.find({ station_id: { $exists: false } });

        // Get all stations
        const allStations = await stationModel.collection.find({}).toArray();

        // Get all active station assignments
        const activeAssignments = await assignmentModel.collection
            .find({ unassignedAt: null })
            .toArray();

        // Create a Set of station IDs that have active assignments
        const assignedStationIds = new Set(
            activeAssignments.map(assignment => assignment.stationId.toString())
        );

        // Filter stations that don't have any active user assignments
        const unassignedStations = allStations.filter(
            station => !assignedStationIds.has(station._id.toString())
        );

        const unassignUser = await userModel.collection
            .find({
                assigned_station_ids: { $in: [null, []] },
                role_id: { $ne: await (new Role(db)).getNextRoleId() }, // Exclude superadmin role
            })
            .toArray();

        res.ok(
            {
                unassignedDevices,
                unassignUser: unassignUser.map(user => ({
                    id: user._id.toString(),
                    user_id: user.user_id,
                    email: user.email,
                    name: user.name,
                    role_id: user.role_id,
                    assigned_station_ids: serializeAssignedStationEntries(user.assigned_station_ids),
                })),
                unassignedStations,
            },
            'Unassigned summary retrieved successfully'
        );
    } catch (error) {
        logger.loggerError(`Get unassigned summary error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};