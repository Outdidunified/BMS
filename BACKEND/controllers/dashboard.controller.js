import { ObjectId } from 'mongodb';
import Device from '../data/Device.model.js';
import Station from '../data/Station.model.js';
import User from '../data/User.model.js';
import Telemetry from '../data/Telemetry.model.js';
import Warning from '../data/Warning.model.js';
import Role from '../data/Role.model.js';
import { getDb } from '../config/db.js';
import logger from '../utils/logger.js';

function collectAssignedStationObjectIds(user) {
    if (!user) {
        return [];
    }

    const candidates = [];

    if (user.station_id) {
        candidates.push(user.station_id);
    }

    if (Array.isArray(user.stations)) {
        candidates.push(...user.stations.filter(Boolean));
    }

    const seen = new Set();
    const normalized = [];

    candidates.forEach(candidate => {
        if (!candidate) {
            return;
        }

        const stringValue = candidate instanceof ObjectId
            ? candidate.toString()
            : candidate.toString();

        if (!ObjectId.isValid(stringValue) || seen.has(stringValue)) {
            return;
        }

        seen.add(stringValue);
        normalized.push(new ObjectId(stringValue));
    });

    return normalized;
}

function buildStationScope(stations = [], user = {}) {
    const stationObjectIdsFromDb = stations
        .map(station => station?._id)
        .filter(Boolean);

    const stationIdStringSet = new Set();

    stationObjectIdsFromDb.forEach(id => {
        try {
            stationIdStringSet.add(id.toString());
        } catch {
            // Ignore invalid conversions
        }
    });

    if (user?.station_id) {
        stationIdStringSet.add(user.station_id.toString());
    }

    if (Array.isArray(user?.stations)) {
        user.stations
            .filter(Boolean)
            .forEach(stationRef => {
                stationIdStringSet.add(stationRef.toString());
            });
    }

    const stationIdStrings = Array.from(stationIdStringSet);

    const stationObjectIdMap = new Map();

    stationObjectIdsFromDb.forEach(id => {
        const key = id.toString();
        if (!stationObjectIdMap.has(key)) {
            stationObjectIdMap.set(key, id);
        }
    });

    stationIdStrings.forEach(idString => {
        if (!stationObjectIdMap.has(idString) && ObjectId.isValid(idString)) {
            stationObjectIdMap.set(idString, new ObjectId(idString));
        }
    });

    const stationObjectIds = Array.from(stationObjectIdMap.values());
    const stationScopeValues = [
        ...stationIdStrings,
        ...stationObjectIds,
    ];

    return {
        stationIdStrings,
        stationObjectIds,
        stationScopeValues,
    };
}

function buildTelemetryStationMatch(stationIdStrings = []) {
    const stringValues = new Set();
    const numericValues = new Set();
    const objectIdMap = new Map();

    (stationIdStrings || []).forEach(id => {
        if (id == null) {
            return;
        }

        let candidate;
        if (id instanceof ObjectId) {
            candidate = id.toString();
            objectIdMap.set(candidate, id);
        } else {
            try {
                candidate = String(id).trim();
            } catch {
                candidate = null;
            }
        }

        if (!candidate) {
            return;
        }

        stringValues.add(candidate);

        if (ObjectId.isValid(candidate) && !objectIdMap.has(candidate)) {
            objectIdMap.set(candidate, new ObjectId(candidate));
        }

        const numericCandidate = Number(candidate);
        if (!Number.isNaN(numericCandidate) && Number.isFinite(numericCandidate)) {
            numericValues.add(numericCandidate);
        }
    });

    const combinedValues = [
        ...stringValues,
        ...objectIdMap.values(),
        ...numericValues,
    ];

    if (!combinedValues.length) {
        return null;
    }

    const stationFields = [
        'device.station_id',
        'device.stationId',
        'device.station',
        'deviceFull.station_id',
        'deviceFull.stationId',
        'station_id',
        'stationId',
        'station.station_id',
        'station.stationId',
    ];

    const orConditions = stationFields.map(field => ({ [field]: { $in: combinedValues } }));

    return { $or: orConditions };
}

async function resolveDashboardContext(req) {
    const db = getDb();
    const stationModel = new Station(db);
    const deviceModel = Device;
    const telemetryModel = Telemetry;
    const warningModel = new Warning(db);

    const user = req.user;
    const isSuperAdmin = user.role === 'superadmin';

    const cache = req.app?.locals?.cache || telemetryModel.cache;

    const collectEmptyPayload = () => ({
        deviceStatus: { labels: ['Online', 'Offline'], data: [0, 0] },
        batteryVoltageTrend: { labels: [], datasets: [{ label: 'Avg Voltage', data: [] }] },
        temperatureTrend: { labels: [], datasets: [{ label: 'Avg Max Temperature', data: [] }] },
        currentTrend: { labels: [], datasets: [{ label: 'Avg Charging Current', data: [] }] },
        warningsSummary: { labels: [], data: [] }
    });

    let stationFilter = {};
    if (!isSuperAdmin) {
        if (!user.stations || user.stations.length === 0) {
            return {
                cache,
                deviceModel,
                telemetryModel,
                warningModel,
                stations: [],
                stationScopeValues: [],
                stationIdStrings: [],
                deviceFilter: { _id: { $in: [] } },
                isSuperAdmin,
                emptyPayload: collectEmptyPayload()
            };
        }
        stationFilter = {
            _id: {
                $in: user.stations.map(id => (typeof id === 'string' ? new ObjectId(id) : id))
            }
        };
    }

    const stations = await stationModel.collection.find(stationFilter).toArray();
    const { stationScopeValues, stationIdStrings } = buildStationScope(stations, user);

    if (!isSuperAdmin && stationScopeValues.length === 0) {
        return {
            cache,
            deviceModel,
            telemetryModel,
            warningModel,
            stations: [],
            stationScopeValues,
            deviceFilter: { _id: { $in: [] } },
            isSuperAdmin,
            emptyPayload: collectEmptyPayload()
        };
    }

    const deviceFilter = isSuperAdmin ? {} : { station_id: { $in: stationScopeValues } };

    return {
        cache,
        deviceModel,
        telemetryModel,
        warningModel,
        stations,
        stationScopeValues,
        stationIdStrings,
        deviceFilter,
        isSuperAdmin,
        emptyPayload: collectEmptyPayload()
    };
}

async function fetchDeviceStatusChart(deviceModel, deviceFilter) {
    const onlineDevices = await deviceModel.collection.countDocuments({ ...deviceFilter, connected: true });
    const offlineDevices = await deviceModel.collection.countDocuments({ ...deviceFilter, connected: { $ne: true } });
    const totalDevices = onlineDevices + offlineDevices;

    return {
        labels: ['Online', 'Offline'],
        data: [onlineDevices, Math.max(totalDevices - onlineDevices, 0)]
    };
}

async function fetchBatteryVoltageTrendChart(telemetryModel, deviceFilter, stationIdStrings = []) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const matchStage = {
        $match: {
            timestamp: { $gte: thirtyDaysAgo },
        },
    };

    const stationMatch = buildTelemetryStationMatch(stationIdStrings);
    if (stationMatch) {
        Object.assign(matchStage.$match, stationMatch);
    }

    const voltageTrendAgg = await telemetryModel.collection.aggregate([
        matchStage,
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                avgVoltage: {
                    $avg: {
                        $ifNull: [
                            '$telemetry.packVoltage',
                            { $ifNull: ['$telemetry.voltage', '$params.pv'] }
                        ]
                    }
                }
            }
        },
        { $sort: { "_id": 1 } }
    ]).toArray();

    return {
        labels: voltageTrendAgg.map(item => item._id),
        datasets: [
            {
                label: 'Avg Voltage',
                data: voltageTrendAgg.map(item => item.avgVoltage || 0)
            }
        ]
    };
}

async function fetchTemperatureTrendChart(telemetryModel, deviceFilter, stationIdStrings = []) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const matchStage = {
        $match: {
            timestamp: { $gte: thirtyDaysAgo },
        },
    };

    const stationMatch = buildTelemetryStationMatch(stationIdStrings);
    if (stationMatch) {
        Object.assign(matchStage.$match, stationMatch);
    }

    const tempTrendAgg = await telemetryModel.collection.aggregate([
        matchStage,
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                avgTemp: {
                    $avg: {
                        $ifNull: [
                            { $max: { $ifNull: ['$telemetry.temperatures', []] } },
                            { $ifNull: ['$telemetry.temperature', '$params.temp'] }
                        ]
                    }
                }
            }
        },
        { $sort: { "_id": 1 } }
    ]).toArray();

    return {
        labels: tempTrendAgg.map(item => item._id),
        datasets: [
            {
                label: 'Avg Max Temperature',
                data: tempTrendAgg.map(item => item.avgTemp || 0)
            }
        ]
    };
}

async function fetchCurrentTrendChart(telemetryModel, deviceFilter, stationIdStrings = []) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const matchStage = {
        $match: {
            timestamp: { $gte: thirtyDaysAgo },
        },
    };

    const stationMatch = buildTelemetryStationMatch(stationIdStrings);
    if (stationMatch) {
        Object.assign(matchStage.$match, stationMatch);
    }

    const currentTrendAgg = await telemetryModel.collection.aggregate([
        matchStage,
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                avgCurrent: {
                    $avg: {
                        $ifNull: [
                            '$telemetry.currents.charging',
                            { $ifNull: ['$telemetry.currentsChg', { $ifNull: ['$telemetry.chargingCurrent', '$params.cc'] }] }
                        ]
                    }
                }
            }
        },
        { $sort: { "_id": 1 } }
    ]).toArray();

    return {
        labels: currentTrendAgg.map(item => item._id),
        datasets: [
            {
                label: 'Avg Charging Current',
                data: currentTrendAgg.map(item => item.avgCurrent || 0)
            }
        ]
    };
}

async function fetchWarningsSummaryChart(warningModel, deviceFilter) {
    const warningsByTypeAgg = await warningModel.collection.aggregate([
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

    return {
        labels: warningsByTypeAgg.map(item => item._id),
        data: warningsByTypeAgg.map(item => item.count)
    };
}

export async function getDeviceStatusChart(req, res) {
    try {
        const {
            cache,
            deviceModel,
            deviceFilter,
            stationScopeValues,
            emptyPayload
        } = await resolveDashboardContext(req);

        if (!stationScopeValues?.length) {
            return res.ok(emptyPayload.deviceStatus, 'Device status chart fetched successfully.');
        }

        const cacheKey = `dashboard_device_status_${req.user.user_id}`;
        const cached = await cache?.get(cacheKey);
        if (cached) {
            return res.ok(cached, 'Device status chart fetched successfully.');
        }

        const deviceStatus = await fetchDeviceStatusChart(deviceModel, deviceFilter);
        await cache?.set(cacheKey, deviceStatus, { ttl: 300 });

        return res.ok(deviceStatus, 'Device status chart fetched successfully.');
    } catch (err) {
        logger.loggerError(`getDeviceStatusChart error: ${err.message || err}`);
        return res.fail('Unable to fetch device status chart. Please try again later.', 500);
    }
}

export async function getBatteryVoltageTrendChart(req, res) {
    try {
        const {
            cache,
            telemetryModel,
            deviceFilter,
            stationIdStrings,
            emptyPayload
        } = await resolveDashboardContext(req);

        const cacheKey = `dashboard_battery_voltage_${req.user.user_id}`;
        const cached = await cache?.get(cacheKey);
        if (cached) {
            return res.ok(cached, 'Battery voltage trend chart fetched successfully.');
        }

        const batteryVoltageTrend = await fetchBatteryVoltageTrendChart(telemetryModel, deviceFilter, stationIdStrings);

        if (!batteryVoltageTrend.labels.length && !batteryVoltageTrend.datasets[0]?.data?.length) {
            await cache?.set(cacheKey, emptyPayload.batteryVoltageTrend, { ttl: 60 });
            return res.ok(emptyPayload.batteryVoltageTrend, 'Battery voltage trend chart fetched successfully.');
        }

        await cache?.set(cacheKey, batteryVoltageTrend, { ttl: 300 });

        return res.ok(batteryVoltageTrend, 'Battery voltage trend chart fetched successfully.');
    } catch (err) {
        logger.loggerError(`getBatteryVoltageTrendChart error: ${err.message || err}`);
        return res.fail('Unable to fetch battery voltage trend chart. Please try again later.', 500);
    }
}

export async function getTemperatureTrendChart(req, res) {
    try {
        const {
            cache,
            telemetryModel,
            deviceFilter,
            stationIdStrings,
            emptyPayload
        } = await resolveDashboardContext(req);

        const cacheKey = `dashboard_temperature_trend_${req.user.user_id}`;
        const cached = await cache?.get(cacheKey);
        if (cached) {
            return res.ok(cached, 'Temperature trend chart fetched successfully.');
        }

        const temperatureTrend = await fetchTemperatureTrendChart(telemetryModel, deviceFilter, stationIdStrings);

        if (!temperatureTrend.labels.length && !temperatureTrend.datasets[0]?.data?.length) {
            await cache?.set(cacheKey, emptyPayload.temperatureTrend, { ttl: 60 });
            return res.ok(emptyPayload.temperatureTrend, 'Temperature trend chart fetched successfully.');
        }

        await cache?.set(cacheKey, temperatureTrend, { ttl: 300 });

        return res.ok(temperatureTrend, 'Temperature trend chart fetched successfully.');
    } catch (err) {
        logger.loggerError(`getTemperatureTrendChart error: ${err.message || err}`);
        return res.fail('Unable to fetch temperature trend chart. Please try again later.', 500);
    }
}

export async function getCurrentTrendChart(req, res) {
    try {
        const {
            cache,
            telemetryModel,
            deviceFilter,
            stationIdStrings,
            emptyPayload
        } = await resolveDashboardContext(req);

        const cacheKey = `dashboard_current_trend_${req.user.user_id}`;
        const cached = await cache?.get(cacheKey);
        if (cached) {
            return res.ok(cached, 'Current trend chart fetched successfully.');
        }

        const currentTrend = await fetchCurrentTrendChart(telemetryModel, deviceFilter, stationIdStrings);

        if (!currentTrend.labels.length && !currentTrend.datasets[0]?.data?.length) {
            await cache?.set(cacheKey, emptyPayload.currentTrend, { ttl: 60 });
            return res.ok(emptyPayload.currentTrend, 'Current trend chart fetched successfully.');
        }

        await cache?.set(cacheKey, currentTrend, { ttl: 300 });

        return res.ok(currentTrend, 'Current trend chart fetched successfully.');
    } catch (err) {
        logger.loggerError(`getCurrentTrendChart error: ${err.message || err}`);
        return res.fail('Unable to fetch current trend chart. Please try again later.', 500);
    }
}

export async function getWarningsSummaryChart(req, res) {
    try {
        const {
            cache,
            warningModel,
            deviceFilter,
            emptyPayload
        } = await resolveDashboardContext(req);

        if (emptyPayload && emptyPayload.warningsSummary.labels.length === 0) {
            return res.ok(emptyPayload.warningsSummary, 'Warnings summary chart fetched successfully.');
        }

        const cacheKey = `dashboard_warnings_summary_${req.user.user_id}`;
        const cached = await cache?.get(cacheKey);
        if (cached) {
            return res.ok(cached, 'Warnings summary chart fetched successfully.');
        }

        const warningsSummary = await fetchWarningsSummaryChart(warningModel, deviceFilter);
        await cache?.set(cacheKey, warningsSummary, { ttl: 300 });

        return res.ok(warningsSummary, 'Warnings summary chart fetched successfully.');
    } catch (err) {
        logger.loggerError(`getWarningsSummaryChart error: ${err.message || err}`);
        return res.fail('Unable to fetch warnings summary chart. Please try again later.', 500);
    }
}

export async function getChartData(req, res) {
    try {
        const {
            cache,
            deviceModel,
            telemetryModel,
            warningModel,
            deviceFilter,
            stationIdStrings,
            emptyPayload
        } = await resolveDashboardContext(req);

        const cacheKeyCharts = `dashboard_charts_${req.user.user_id}`;
        const cachedCharts = await cache?.get(cacheKeyCharts);
        if (cachedCharts) {
            return res.ok(cachedCharts, 'Chart data fetched successfully.');
        }

        const [
            deviceStatus,
            batteryVoltageTrend,
            temperatureTrend,
            currentTrend,
            warningsSummary
        ] = await Promise.all([
            fetchDeviceStatusChart(deviceModel, deviceFilter),
            fetchBatteryVoltageTrendChart(telemetryModel, deviceFilter, stationIdStrings),
            fetchTemperatureTrendChart(telemetryModel, deviceFilter, stationIdStrings),
            fetchCurrentTrendChart(telemetryModel, deviceFilter, stationIdStrings),
            fetchWarningsSummaryChart(warningModel, deviceFilter)
        ]);

        if (
            deviceStatus.data.every(value => value === 0) &&
            !batteryVoltageTrend.labels.length &&
            !temperatureTrend.labels.length &&
            !currentTrend.labels.length &&
            !warningsSummary.labels?.length
        ) {
            await cache?.set(cacheKeyCharts, emptyPayload, { ttl: 60 });
            return res.ok(emptyPayload, 'Chart data fetched successfully.');
        }

        const resultPayload = {
            deviceStatus,
            batteryVoltageTrend,
            temperatureTrend,
            currentTrend,
            warningsSummary
        };

        await cache?.set(cacheKeyCharts, resultPayload, { ttl: 300 });

        return res.ok(resultPayload, 'Chart data fetched successfully.');
    } catch (err) {
        logger.loggerError(`getChartData error: ${err.message || err}`);
        return res.fail('Unable to fetch chart data. Please try again later.', 500);
    }
}

export async function dashboardSummary(req, res) {
    try {
        const db = getDb();
        const stationModel = new Station(db);
        const deviceModel = Device; // Device has a collection getter
        const userModel = new User(db);
        const telemetryModel = Telemetry; // Telemetry has a collection getter
        const warningModel = new Warning(db);

        const cache = req.app?.locals?.cache || telemetryModel.cache;
        const cacheKey = `dashboard_summary_${req.user?.user_id ?? 'anonymous'}`;

        const cachedSummary = await cache?.get(cacheKey);
        if (cachedSummary) {
            return res.ok(cachedSummary, 'Dashboard summary fetched successfully.');
        }

        const user = req.user;
        const isSuperAdmin = user.role === 'superadmin'; // Assuming role name is 'superadmin'

        let stationFilter = {};
        if (!isSuperAdmin) {
            const assignedStationObjectIds = collectAssignedStationObjectIds(user);

            if (assignedStationObjectIds.length === 0) {
                const emptyPayload = {
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
                };
                if (cache) {
                    await cache.set(cacheKey, emptyPayload, { ttl: 300 });
                }
                return res.ok(emptyPayload, 'Dashboard summary fetched successfully.');
            }
            stationFilter = { _id: { $in: assignedStationObjectIds } };
        }

        const stations = await stationModel.collection.find(stationFilter).toArray();
        const { stationIdStrings, stationObjectIds, stationScopeValues } = buildStationScope(stations, user);

        if (!isSuperAdmin && stationScopeValues.length === 0) {
            const emptyPayload = {
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
            };
            if (cache) {
                await cache.set(cacheKey, emptyPayload, { ttl: 300 });
            }
            return res.ok(emptyPayload, 'Dashboard summary fetched successfully.');
        }

        const stationIds = isSuperAdmin ? stations.map(s => s._id) : stationObjectIds;

        const deviceFilter = isSuperAdmin
            ? {}
            : { station_id: { $in: stationScopeValues } };

        const totalDevices = await deviceModel.collection.countDocuments(deviceFilter);
        const onlineDevices = await deviceModel.collection.countDocuments({ ...deviceFilter, connected: true });
        const offlineDevices = totalDevices - onlineDevices;

        const totalStations = stations.length;
        const activeStations = stations.filter(s => s.status).length;
        const inactiveStations = totalStations - activeStations;

        const userFilter = isSuperAdmin
            ? {}
            : {
                $or: [
                    { station_id: { $in: stationObjectIds } },
                    { stations: { $in: stationObjectIds } },
                ],
            };
        const totalUsers = await userModel.collection.countDocuments(userFilter);
        const activeUsers = await userModel.collection.countDocuments({ ...userFilter, status: true });

        const usersByRoleAgg = await userModel.collection.aggregate([
            { $match: { ...userFilter } },
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
        usersByRoleAgg.forEach(r => {
            if (r?._id) {
                usersByRole[r._id] = r.count;
            }
        });

        const warningMatchStage = isSuperAdmin
            ? {}
            : { station_id: { $in: stationScopeValues } };

        const totalWarningsAgg = await warningModel.collection.aggregate([
            { $match: warningMatchStage },
            { $count: 'count' }
        ]).toArray();
        const totalWarnings = totalWarningsAgg[0]?.count || 0;

        const warningsByTypeAgg = await warningModel.collection.aggregate([
            { $match: warningMatchStage },
            { $project: { thresholds: { $objectToArray: '$thresholds' } } },
            { $unwind: '$thresholds' },
            { $group: { _id: '$thresholds.k', count: { $sum: 1 } } }
        ]).toArray();
        const warningsByType = {};
        warningsByTypeAgg.forEach(w => {
            if (w._id) {
                warningsByType[w._id] = w.count;
            }
        });

        const oneHourAgo = new Date(Date.now() - 3600000);
        const batteryMatchStage = {
            timestamp: { $gte: oneHourAgo },
            ...(isSuperAdmin
                ? {}
                : { 'device.station_id': { $in: stationScopeValues } })
        };

        const batteryHealthAgg = await telemetryModel.collection.aggregate([
            { $match: batteryMatchStage },
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
        const resultPayload = {
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
        };

        await cache?.set(`dashboard_summary_${user.user_id}`, resultPayload, { ttl: 300 });

        return res.ok(resultPayload, 'Dashboard summary fetched successfully.');
    } catch (err) {
        logger.loggerError(`dashboardSummary error: ${err.message || err}`);
        return res.fail('Unable to fetch dashboard summary. Please try again later.', 500);
    }
}