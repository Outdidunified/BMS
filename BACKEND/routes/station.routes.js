import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
    getStations,
    getStation,
    createStation,
    updateStation,
    deleteStation,
    assignDeviceToStation,
    unassignDeviceFromStation,
    assignUserToStation,
    unassignUserFromStation,
    getStationDevices,
} from '../controllers/station.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Superadmin only: CRUD stations
router.get('/getStations', getStations);
router.post('/createStation', createStation);
router.get('/getStation/:stationId', getStation);
router.put('/updateStation/:stationId', updateStation);
router.delete('/deleteStation/:stationId', deleteStation);

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

export default router;