import express from 'express';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import {
    getStations,
    getStation,
    createStation,
    updateStation,
    deactivateStation,
    assignDeviceToStation,
    unassignDeviceFromStation,
    assignUserToStation,
    unassignUserFromStation,
    getStationDevices,
    getUnassignedSummary,
} from '../controllers/station.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Superadmin only: CRUD stations
router.get('/getStations', getStations);
router.post('/createStation', requireRole('superadmin'), createStation);
router.get('/getStation/:stationId', requireRole('superadmin'), getStation);
router.put('/updateStation/:stationId', requireRole('superadmin'), updateStation);
router.put('/deactivateStation/:stationId', requireRole('superadmin'), deactivateStation);

// Assign device to station
router.post('/assignDevice/:stationId', assignDeviceToStation);

// Unassign device from station
router.post('/unassignDevice/:stationId', unassignDeviceFromStation);

// Assign user to station
router.post('/assignUser/:stationId', assignUserToStation);

// Unassign user from station
router.post('/unassignUser/:stationId', unassignUserFromStation);

// Get devices in station
router.get('/getDevices/:stationId', getStationDevices);

// Get unassigned summaries
router.get('/unassignedSummary', requireRole('superadmin'), getUnassignedSummary);

export default router;