import { ObjectId } from 'mongodb';
import Device from '../data/Device.model.js';
import Station from '../data/Station.model.js';
import User from '../data/User.model.js';
import Telemetry from '../data/Telemetry.model.js';
import Warning from '../data/Warning.model.js';
import Role from '../data/Role.model.js';
import { getDb } from '../config/db.js';
import logger from '../utils/logger.js';

export async function getChartData(req, res) {
    try {
        const user = req.user;
        const isSuperAdmin = user.role === 'superadmin';

        let stationFilter = {};
        if (!isSuperAdmin) {
            if (!user.stations || user.stations.length === 0) {
                return res.ok({
                    deviceStatusPie: { labels: ['Online', 'Offline'], data: [0, 0] },
                    batteryVoltageTrend: { labels: [], datasets: [{ label: 'Avg Voltage', data: [] }] },
                    temperatureTrend: { labels: [], datasets: [{ label: 'Avg Max Temperature', data: [] }] },
                    currentTrend: { labels: [], datasets: [{ label: 'Avg Charging Current', data: [] }] },
                    warningsBar: { labels: [], data: [] }
                }, 'Chart data fetched successfully.');
            }
            stationFilter = { _id: { $in: user.stations.map(id => typeof id === 'string' ? new ObjectId(id) : id) } };
        }

        // Get stations
        const stations = await Station.collection.find(stationFilter).toArray();
        const stationIds = stations.map(s => s._id);

        // Device filter
        const deviceFilter = isSuperAdmin ? {} : { station_id: { $in: stationIds } };

        // Total devices
        const totalDevices = await Device.collection.countDocuments(deviceFilter);

        // Online devices
        const oneHourAgo = new Date(Date.now() - 3600000);
        const onlineDevicesAgg = await Telemetry.collection.aggregate([
            {
                $match: {
                    timestamp: { $gte: oneHourAgo },
                    $or: [
                        { 'device.DI': { $exists: true } },
                        { 'deviceFull.deviceId': { $exists: true } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'devices',
                    let: { di: { $ifNull: ['$device.DI', '$deviceFull.deviceId'] } },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$di'] }, { $eq: ['$DI', '$$di'] }] } } },
                        { $match: deviceFilter },
                        { $project: { _id: 1 } }
                    ],
                    as: 'device'
                }
            },
            { $match: { 'device.0': { $exists: true } } },
            { $group: { _id: null, count: { $sum: 1 } } }
        ]).toArray();
        const onlineDevices = onlineDevicesAgg[0]?.count || 0;
        const offlineDevices = totalDevices - onlineDevices;

        // Device Status Pie Chart
        const deviceStatusPie = {
            labels: ['Online', 'Offline'],
            data: [onlineDevices, offlineDevices]
        };

        // Time-series for last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Battery Voltage Trend
        const voltageTrendAgg = await Telemetry.collection.aggregate([
            { $match: { timestamp: { $gte: thirtyDaysAgo } } },
            {
                $lookup: {
                    from: 'devices',
                    let: { di: { $ifNull: ['$device.DI', '$deviceFull.deviceId'] } },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$di'] }, { $eq: ['$DI', '$$di'] }] } } },
                        { $match: deviceFilter }
                    ],
                    as: 'device'
                }
            },
            { $match: { 'device.0': { $exists: true } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    avgVoltage: { $avg: { $ifNull: ['$telemetry.packVoltage', '$params.pv'] } }
                }
            },
            { $sort: { "_id": 1 } }
        ]).toArray();
        const batteryVoltageTrend = {
            labels: voltageTrendAgg.map(item => item._id),
            datasets: [{
                label: 'Avg Voltage',
                data: voltageTrendAgg.map(item => item.avgVoltage || 0)
            }]
        };

        // Temperature Trend
        const tempTrendAgg = await Telemetry.collection.aggregate([
            { $match: { timestamp: { $gte: thirtyDaysAgo } } },
            {
                $lookup: {
                    from: 'devices',
                    let: { di: { $ifNull: ['$device.DI', '$deviceFull.deviceId'] } },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$di'] }, { $eq: ['$DI', '$$di'] }] } } },
                        { $match: deviceFilter }
                    ],
                    as: 'device'
                }
            },
            { $match: { 'device.0': { $exists: true } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    avgTemp: { $avg: { $max: { $ifNull: ['$telemetry.temperatures', []] } } }
                }
            },
            { $sort: { "_id": 1 } }
        ]).toArray();
        const temperatureTrend = {
            labels: tempTrendAgg.map(item => item._id),
            datasets: [{
                label: 'Avg Max Temperature',
                data: tempTrendAgg.map(item => item.avgTemp || 0)
            }]
        };

        // Current Trend
        const currentTrendAgg = await Telemetry.collection.aggregate([
            { $match: { timestamp: { $gte: thirtyDaysAgo } } },
            {
                $lookup: {
                    from: 'devices',
                    let: { di: { $ifNull: ['$device.DI', '$deviceFull.deviceId'] } },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$di'] }, { $eq: ['$DI', '$$di'] }] } } },
                        { $match: deviceFilter }
                    ],
                    as: 'device'
                }
            },
            { $match: { 'device.0': { $exists: true } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    avgCurrent: { $avg: { $ifNull: ['$telemetry.currents.charging', '$params.cc'] } }
                }
            },
            { $sort: { "_id": 1 } }
        ]).toArray();
        const currentTrend = {
            labels: currentTrendAgg.map(item => item._id),
            datasets: [{
                label: 'Avg Charging Current',
                data: currentTrendAgg.map(item => item.avgCurrent || 0)
            }]
        };

        // Warnings Bar Chart
        const warningsByTypeAgg = await Warning.collection.aggregate([
            {
                $lookup: {
                    from: 'devices',
                    let: { deviceId: '$deviceId' },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$deviceId'] }, { $eq: ['$DI', '$$deviceId'] }] } } },
                        { $match: deviceFilter }
                    ],
                    as: 'device'
                }
            },
            { $match: { 'device.0': { $exists: true } } },
            { $project: { thresholds: { $objectToArray: '$thresholds' } } },
            { $unwind: '$thresholds' },
            { $group: { _id: '$thresholds.k', count: { $sum: 1 } } }
        ]).toArray();
        const warningsBar = {
            labels: warningsByTypeAgg.map(item => item._id),
            data: warningsByTypeAgg.map(item => item.count)
        };

        logger.loggerInfo(`Chart data for user ${user.user_id}`);
        return res.ok({
            deviceStatusPie,
            batteryVoltageTrend,
            temperatureTrend,
            currentTrend,
            warningsBar
        }, 'Chart data fetched successfully.');
    } catch (err) {
        logger.loggerError(`getChartData error: ${err.message || err}`);
        return res.fail('Unable to fetch chart data. Please try again later.', 500);
    }
}

export async function dashboardSummary(req, res) {
    try {
        const user = req.user;
        const isSuperAdmin = user.role === 'superadmin'; // Assuming role name is 'superadmin'

        let stationFilter = {};
        if (!isSuperAdmin) {
            // For station masters, filter by assigned stations
            if (!user.stations || user.stations.length === 0) {
                return res.ok({
                    totalDevices: 0,
                    onlineDevices: 0,
                    offlineDevices: 0,
                    totalStations: 0,
                    activeStations: 0,
                    inactiveStations: 0,
                    totalUsers: 0,
                    activeUsers: 0,
                    totalWarnings: 0,
                    batteryHealth: { avgPackVoltage: 0, avgTemperature: 0, avgChargingCurrent: 0 },
                    usersByRole: {},
                    warningsByType: {}
                }, 'Dashboard summary fetched successfully.');
            }
            stationFilter = { _id: { $in: user.stations.map(id => typeof id === 'string' ? new ObjectId(id) : id) } };
        }

        // Get stations
        const stations = await Station.collection.find(stationFilter).toArray();
        const stationIds = stations.map(s => s._id);

        // Device filter
        const deviceFilter = isSuperAdmin ? {} : { station_id: { $in: stationIds } };

        // Total devices
        const totalDevices = await Device.collection.countDocuments(deviceFilter);

        // Online devices: devices with telemetry in last 1 hour
        const oneHourAgo = new Date(Date.now() - 3600000);
        const onlineDevicesAgg = await Telemetry.collection.aggregate([
            {
                $match: {
                    timestamp: { $gte: oneHourAgo },
                    $or: [
                        { 'device.DI': { $exists: true } },
                        { 'deviceFull.deviceId': { $exists: true } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'devices',
                    let: { di: { $ifNull: ['$device.DI', '$deviceFull.deviceId'] } },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$di'] }, { $eq: ['$DI', '$$di'] }] } } },
                        { $match: deviceFilter },
                        { $project: { _id: 1 } }
                    ],
                    as: 'device'
                }
            },
            { $match: { 'device.0': { $exists: true } } },
            { $group: { _id: null, count: { $sum: 1 } } }
        ]).toArray();
        const onlineDevices = onlineDevicesAgg[0]?.count || 0;
        const offlineDevices = totalDevices - onlineDevices;

        // Stations
        const totalStations = stations.length;
        const activeStations = stations.filter(s => s.status).length;
        const inactiveStations = totalStations - activeStations;

        // Users
        const userFilter = isSuperAdmin ? {} : { stations: { $in: stationIds } };
        const totalUsers = await User.collection.countDocuments(userFilter);
        const activeUsers = await User.collection.countDocuments({ ...userFilter, status: true });

        // Users by role
        const usersByRoleAgg = await User.collection.aggregate([
            { $match: userFilter },
            {
                $lookup: {
                    from: 'roles',
                    localField: 'role_id',
                    foreignField: 'role_id',
                    as: 'role'
                }
            },
            { $unwind: '$role' },
            { $group: { _id: '$role.name', count: { $sum: 1 } } }
        ]).toArray();
        const usersByRole = {};
        usersByRoleAgg.forEach(r => usersByRole[r._id] = r.count);

        // Total warnings
        const totalWarningsAgg = await Warning.collection.aggregate([
            {
                $lookup: {
                    from: 'devices',
                    let: { deviceId: '$deviceId' },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$deviceId'] }, { $eq: ['$DI', '$$deviceId'] }] } } },
                        { $match: deviceFilter }
                    ],
                    as: 'device'
                }
            },
            { $match: { 'device.0': { $exists: true } } },
            { $count: 'count' }
        ]).toArray();
        const totalWarnings = totalWarningsAgg[0]?.count || 0;

        // Warnings by type (simplified)
        const warningsByTypeAgg = await Warning.collection.aggregate([
            {
                $lookup: {
                    from: 'devices',
                    let: { deviceId: '$deviceId' },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$deviceId'] }, { $eq: ['$DI', '$$deviceId'] }] } } },
                        { $match: deviceFilter }
                    ],
                    as: 'device'
                }
            },
            { $match: { 'device.0': { $exists: true } } },
            { $project: { thresholds: { $objectToArray: '$thresholds' } } },
            { $unwind: '$thresholds' },
            { $group: { _id: '$thresholds.k', count: { $sum: 1 } } }
        ]).toArray();
        const warningsByType = {};
        warningsByTypeAgg.forEach(w => warningsByType[w._id] = w.count);

        // Battery health: avg from recent telemetry
        const batteryHealthAgg = await Telemetry.collection.aggregate([
            { $match: { timestamp: { $gte: oneHourAgo } } },
            {
                $lookup: {
                    from: 'devices',
                    let: { di: { $ifNull: ['$device.DI', '$deviceFull.deviceId'] } },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$di'] }, { $eq: ['$DI', '$$di'] }] } } },
                        { $match: deviceFilter }
                    ],
                    as: 'device'
                }
            },
            { $match: { 'device.0': { $exists: true } } },
            {
                $group: {
                    _id: null,
                    avgPackVoltage: { $avg: { $ifNull: ['$telemetry.packVoltage', '$params.pv'] } },
                    avgTemperature: { $avg: { $max: { $ifNull: ['$telemetry.temperatures', []] } } },
                    avgChargingCurrent: { $avg: { $ifNull: ['$telemetry.currents.charging', '$params.cc'] } }
                }
            }
        ]).toArray();
        const batteryHealth = batteryHealthAgg[0] || { avgPackVoltage: 0, avgTemperature: 0, avgChargingCurrent: 0 };

        logger.loggerInfo(`Dashboard summary for user ${user.user_id}`);
        return res.ok({
            totalDevices,
            onlineDevices,
            offlineDevices,
            totalStations,
            activeStations,
            inactiveStations,
            totalUsers,
            activeUsers,
            totalWarnings,
            batteryHealth,
            usersByRole,
            warningsByType
        }, 'Dashboard summary fetched successfully.');
    } catch (err) {
        logger.loggerError(`dashboardSummary error: ${err.message || err}`);
        return res.fail('Unable to fetch dashboard summary. Please try again later.', 500);
    }
}