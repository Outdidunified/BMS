import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import assert from 'node:assert/strict';

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'production'}` });
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 8070}`;
const LOGIN_EMAIL = process.env.TEST_EMAIL || 'superadmin@gmail.com';
const LOGIN_PASSWORD = process.env.TEST_PASSWORD || 'Superadmin@123';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/BMS';

function approxEqual(a, b, epsilon = 1e-3) {
  if (a == null && b == null) return true;
  const left = typeof a === 'number' ? a : 0;
  const right = typeof b === 'number' ? b : 0;
  return Math.abs(left - right) <= epsilon;
}

function arraysApproxEqual(a, b) {
  assert.strictEqual(a.length, b.length);
  for (let i = 0; i < a.length; i += 1) {
    assert(approxEqual(Number(a[i]) || 0, Number(b[i]) || 0));
  }
}

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
    const stringValue = candidate instanceof ObjectId ? candidate.toString() : candidate.toString();
    if (!ObjectId.isValid(stringValue) || seen.has(stringValue)) {
      return;
    }
    seen.add(stringValue);
    normalized.push(new ObjectId(stringValue));
  });
  return normalized;
}

function buildStationScope(stations = [], user = {}) {
  const stationObjectIdsFromDb = stations.map(station => station?._id).filter(Boolean);
  const stationIdStringSet = new Set();
  stationObjectIdsFromDb.forEach(id => {
    try {
      stationIdStringSet.add(id.toString());
    } catch {}
  });
  if (user?.station_id) {
    stationIdStringSet.add(user.station_id.toString());
  }
  if (Array.isArray(user?.stations)) {
    user.stations.filter(Boolean).forEach(stationRef => {
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
  const stationScopeValues = [...stationIdStrings, ...stationObjectIds];
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
  const combinedValues = [...stringValues, ...objectIdMap.values(), ...numericValues];
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

async function login() {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  assert.strictEqual(response.ok, true);
  const payload = await response.json();
  assert.strictEqual(payload.success, true);
  const { token, user } = payload.data;
  assert(token);
  assert(user);
  return { token, user };
}

async function requestWithAuth(path, token) {
  const url = new URL(path, API_BASE_URL);
  url.searchParams.set('_ts', Date.now().toString());
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  assert.strictEqual(response.ok, true);
  const payload = await response.json();
  assert.strictEqual(payload.success, true);
  return payload.data;
}

async function computeDeviceStatus(collection, deviceFilter) {
  const onlineDevices = await collection.countDocuments({ ...deviceFilter, connected: true });
  const totalDevices = await collection.countDocuments(deviceFilter);
  const offlineDevices = Math.max(totalDevices - onlineDevices, 0);
  return {
    labels: ['Online', 'Offline'],
    data: [onlineDevices, offlineDevices],
  };
}

async function computeBatteryVoltageTrend(collection, stationIdStrings) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const match = { timestamp: { $gte: thirtyDaysAgo } };
  const stationMatch = buildTelemetryStationMatch(stationIdStrings);
  if (stationMatch) {
    Object.assign(match, stationMatch);
  }
  const items = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          avgVoltage: {
            $avg: {
              $ifNull: ['$telemetry.packVoltage', { $ifNull: ['$telemetry.voltage', '$params.pv'] }],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  return {
    labels: items.map(item => item._id),
    datasets: [
      {
        label: 'Avg Voltage',
        data: items.map(item => item.avgVoltage || 0),
      },
    ],
  };
}

async function computeTemperatureTrend(collection, stationIdStrings) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const match = { timestamp: { $gte: thirtyDaysAgo } };
  const stationMatch = buildTelemetryStationMatch(stationIdStrings);
  if (stationMatch) {
    Object.assign(match, stationMatch);
  }
  const items = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          avgTemp: {
            $avg: {
              $ifNull: [
                { $max: { $ifNull: ['$telemetry.temperatures', []] } },
                { $ifNull: ['$telemetry.temperature', '$params.temp'] },
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  return {
    labels: items.map(item => item._id),
    datasets: [
      {
        label: 'Avg Max Temperature',
        data: items.map(item => item.avgTemp || 0),
      },
    ],
  };
}

async function computeCurrentTrend(collection, stationIdStrings) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const match = { timestamp: { $gte: thirtyDaysAgo } };
  const stationMatch = buildTelemetryStationMatch(stationIdStrings);
  if (stationMatch) {
    Object.assign(match, stationMatch);
  }
  const items = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          avgCurrent: {
            $avg: {
              $ifNull: [
                '$telemetry.currents.charging',
                {
                  $ifNull: [
                    '$telemetry.currentsChg',
                    { $ifNull: ['$telemetry.chargingCurrent', '$params.cc'] },
                  ],
                },
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  return {
    labels: items.map(item => item._id),
    datasets: [
      {
        label: 'Avg Charging Current',
        data: items.map(item => item.avgCurrent || 0),
      },
    ],
  };
}

async function computeWarningsSummary(db, deviceFilter) {
  const pipeline = [
    {
      $lookup: {
        from: 'devices',
        let: { deviceId: '$deviceId' },
        pipeline: [
          { $match: { $expr: { $or: [{ $eq: ['$deviceId', '$$deviceId'] }, { $eq: ['$DI', '$$deviceId'] }] } } },
          { $match: deviceFilter },
        ],
        as: 'device',
      },
    },
    { $match: { 'device.0': { $exists: true } } },
    { $project: { thresholds: { $objectToArray: '$thresholds' } } },
    { $unwind: '$thresholds' },
    { $group: { _id: '$thresholds.k', count: { $sum: 1 } } },
  ];
  const items = await db.collection('warnings').aggregate(pipeline).toArray();
  return {
    labels: items.map(item => item._id),
    data: items.map(item => item.count),
  };
}

async function computeSummary(db, deviceFilter, userFilter, stationScopeValues, stationIdStrings, isSuperAdmin) {
  const devices = db.collection('devices');
  const stations = db.collection('stations');
  const users = db.collection('users');
  const telemetry = db.collection('battery_data');
  const warnings = db.collection('warnings');
  const totalDevices = await devices.countDocuments(deviceFilter);
  const onlineDevices = await devices.countDocuments({ ...deviceFilter, connected: true });
  const totalStations = await stations.countDocuments(isSuperAdmin ? {} : { _id: { $in: stationScopeValues } });
  const activeStations = await stations.countDocuments({ ...(isSuperAdmin ? {} : { _id: { $in: stationScopeValues } }), status: true });
  const totalUsers = await users.countDocuments(userFilter);
  const activeUsers = await users.countDocuments({ ...userFilter, status: true });
  const warningsCount = await warnings.countDocuments(isSuperAdmin ? {} : { station_id: { $in: stationScopeValues } });
  const usersByRoleAgg = await users
    .aggregate([
      { $match: userFilter },
      {
        $lookup: {
          from: 'roles',
          localField: 'role_id',
          foreignField: 'role_id',
          as: 'role',
        },
      },
      { $unwind: '$role' },
      { $group: { _id: '$role.name', count: { $sum: 1 } } },
    ])
    .toArray();
  const usersByRole = {};
  usersByRoleAgg.forEach(entry => {
    if (entry?._id) {
      usersByRole[entry._id] = entry.count;
    }
  });
  const warningsByTypeAgg = await db
    .collection('warnings')
    .aggregate([
      ...(isSuperAdmin
        ? []
        : [
            {
              $match: {
                station_id: { $in: stationScopeValues },
              },
            },
          ]),
      { $project: { thresholds: { $objectToArray: '$thresholds' } } },
      { $unwind: '$thresholds' },
      { $group: { _id: '$thresholds.k', count: { $sum: 1 } } },
    ])
    .toArray();
  const warningsByType = {};
  warningsByTypeAgg.forEach(entry => {
    if (entry?._id) {
      warningsByType[entry._id] = entry.count;
    }
  });
  const oneHourAgo = new Date(Date.now() - 3600000);
  const batteryMatch = { timestamp: { $gte: oneHourAgo } };
  if (!isSuperAdmin && stationScopeValues.length) {
    batteryMatch['device.station_id'] = { $in: stationScopeValues };
  }
  const batteryAgg = await telemetry
    .aggregate([
      { $match: batteryMatch },
      {
        $group: {
          _id: null,
          avgPackVoltage: { $avg: { $ifNull: ['$telemetry.packVoltage', '$params.pv'] } },
          avgTemperature: { $avg: { $max: { $ifNull: ['$telemetry.temperatures', []] } } },
          avgChargingCurrent: { $avg: { $ifNull: ['$telemetry.currents.charging', '$params.cc'] } },
        },
      },
    ])
    .toArray();
  const batteryHealth = batteryAgg[0] || { avgPackVoltage: 0, avgTemperature: 0, avgChargingCurrent: 0 };
  return {
    totalDevices,
    onlineDevices,
    offlineDevices: Math.max(totalDevices - onlineDevices, 0),
    totalStations,
    activeStations,
    inactiveStations: Math.max(totalStations - activeStations, 0),
    totalUsers,
    activeUsers,
    totalWarnings: warningsCount,
    batteryHealth,
    usersByRole,
    warningsByType,
  };
}

async function loadRequestUser(db, loginUser) {
  const usersCollection = db.collection('users');
  const rolesCollection = db.collection('roles');
  const record = await usersCollection.findOne({ _id: new ObjectId(loginUser._id) });
  if (!record) {
    throw new Error('User not found in database');
  }
  const role = await rolesCollection.findOne({ role_id: Number(record.role_id) });
  const normalizedStations = Array.isArray(record.stations)
    ? Array.from(new Set(record.stations.filter(Boolean).map(station => station.toString())))
    : [];
  let primaryStationId = null;
  if (record.station_id) {
    primaryStationId = record.station_id.toString();
  }
  if (!primaryStationId && normalizedStations.length) {
    primaryStationId = normalizedStations[0];
  }
  if (primaryStationId && !normalizedStations.includes(primaryStationId)) {
    normalizedStations.unshift(primaryStationId);
  }
  const { password, ...userWithoutPassword } = record;
  return {
    ...userWithoutPassword,
    role: role?.name || 'stationmaster',
    permissions: role?.permissions || {},
    station_id: primaryStationId,
    stations: normalizedStations,
  };
}

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  try {
    const { token, user: loginUser } = await login();
    const requestUser = await loadRequestUser(db, loginUser);
    const stationsCollection = db.collection('stations');
    let stationFilter = {};
    if (requestUser.role !== 'superadmin') {
      const assigned = collectAssignedStationObjectIds(requestUser);
      stationFilter = assigned.length ? { _id: { $in: assigned } } : { _id: { $in: [] } };
    }
    const stations = await stationsCollection.find(stationFilter).toArray();
    const { stationScopeValues, stationIdStrings, stationObjectIds } = buildStationScope(stations, requestUser);
    const isSuperAdmin = requestUser.role === 'superadmin';
    const deviceFilter = isSuperAdmin ? {} : { station_id: { $in: stationScopeValues } };
    const userFilter = isSuperAdmin
      ? {}
      : {
          $or: [
            { station_id: { $in: stationObjectIds } },
            { stations: { $in: stationObjectIds } },
          ],
        };
    const summaryData = await requestWithAuth('/dashboard/summary', token);
    const expectedSummary = await computeSummary(
      db,
      deviceFilter,
      userFilter,
      stationScopeValues,
      stationIdStrings,
      isSuperAdmin,
    );
    assert.strictEqual(summaryData.totalDevices, expectedSummary.totalDevices);
    assert.strictEqual(summaryData.onlineDevices, expectedSummary.onlineDevices);
    assert.strictEqual(summaryData.offlineDevices, expectedSummary.offlineDevices);
    assert.strictEqual(summaryData.totalStations, expectedSummary.totalStations);
    assert.strictEqual(summaryData.activeStations, expectedSummary.activeStations);
    assert.strictEqual(summaryData.inactiveStations, expectedSummary.inactiveStations);
    assert.strictEqual(summaryData.totalUsers, expectedSummary.totalUsers);
    assert.strictEqual(summaryData.activeUsers, expectedSummary.activeUsers);
    assert.strictEqual(summaryData.totalWarnings, expectedSummary.totalWarnings);
    Object.entries(expectedSummary.usersByRole).forEach(([roleName, value]) => {
      assert.strictEqual(summaryData.usersByRole?.[roleName] || 0, value);
    });
    Object.entries(expectedSummary.warningsByType).forEach(([key, value]) => {
      assert.strictEqual(summaryData.warningsByType?.[key] || 0, value);
    });
    ['avgPackVoltage', 'avgTemperature', 'avgChargingCurrent'].forEach(metric => {
      assert(approxEqual((summaryData.batteryHealth?.[metric]) ?? 0, expectedSummary.batteryHealth?.[metric] ?? 0));
    });
    const devicesCollection = db.collection('devices');
    const telemetryCollection = db.collection('battery_data');
    const deviceStatusData = await requestWithAuth('/dashboard/device-status', token);
    const expectedDeviceStatus = await computeDeviceStatus(devicesCollection, deviceFilter);
    assert.deepStrictEqual(deviceStatusData.labels, expectedDeviceStatus.labels);
    assert.deepStrictEqual(deviceStatusData.data, expectedDeviceStatus.data);
    const batteryVoltageData = await requestWithAuth('/dashboard/battery-voltage', token);
    const expectedVoltage = await computeBatteryVoltageTrend(telemetryCollection, stationIdStrings);
    assert.deepStrictEqual(batteryVoltageData.labels, expectedVoltage.labels);
    arraysApproxEqual(batteryVoltageData.datasets[0]?.data || [], expectedVoltage.datasets[0]?.data || []);
    const temperatureData = await requestWithAuth('/dashboard/temperature-trend', token);
    const expectedTemperature = await computeTemperatureTrend(telemetryCollection, stationIdStrings);
    assert.deepStrictEqual(temperatureData.labels, expectedTemperature.labels);
    arraysApproxEqual(temperatureData.datasets[0]?.data || [], expectedTemperature.datasets[0]?.data || []);
    const currentData = await requestWithAuth('/dashboard/current-trend', token);
    const expectedCurrent = await computeCurrentTrend(telemetryCollection, stationIdStrings);
    assert.deepStrictEqual(currentData.labels, expectedCurrent.labels);
    arraysApproxEqual(currentData.datasets[0]?.data || [], expectedCurrent.datasets[0]?.data || []);
    const warningsSummaryData = await requestWithAuth('/dashboard/warnings-summary', token);
    const expectedWarningsSummary = await computeWarningsSummary(db, deviceFilter);
    assert.deepStrictEqual(warningsSummaryData.labels, expectedWarningsSummary.labels);
    assert.deepStrictEqual(warningsSummaryData.data, expectedWarningsSummary.data);
    const chartsData = await requestWithAuth('/dashboard/charts', token);
    assert.deepStrictEqual(chartsData.deviceStatus.labels, deviceStatusData.labels);
    assert.deepStrictEqual(chartsData.deviceStatus.data, deviceStatusData.data);
    assert.deepStrictEqual(chartsData.batteryVoltageTrend.labels, batteryVoltageData.labels);
    arraysApproxEqual(chartsData.batteryVoltageTrend.datasets[0]?.data || [], batteryVoltageData.datasets[0]?.data || []);
    assert.deepStrictEqual(chartsData.temperatureTrend.labels, temperatureData.labels);
    arraysApproxEqual(chartsData.temperatureTrend.datasets[0]?.data || [], temperatureData.datasets[0]?.data || []);
    assert.deepStrictEqual(chartsData.currentTrend.labels, currentData.labels);
    arraysApproxEqual(chartsData.currentTrend.datasets[0]?.data || [], currentData.datasets[0]?.data || []);
    assert.deepStrictEqual(chartsData.warningsSummary.labels, warningsSummaryData.labels);
    assert.deepStrictEqual(chartsData.warningsSummary.data, warningsSummaryData.data);
    console.log('All dashboard route checks passed.');
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error('Dashboard route tests failed:', err);
  process.exit(1);
});
