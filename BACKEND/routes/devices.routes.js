import express from 'express';
import {
    createDevice,
    listDevices,
    updateDevice,
    deleteDevice,
    getDevice,
    updateDeviceStatus,
    assignDeviceToUser,
    unassignDeviceFromUser
} from '../controllers/devices.controller.js';
import { authenticate, authorize, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();
// More descriptive routes
router.post('/create', authenticate, requireRole('superadmin'), createDevice);
router.get('/fetch-all', authenticate, authorize('view_devices'), listDevices);
router.get('/:di', authenticate, authorize('view_devices'), getDevice);
router.put('/update/:di', authenticate, requireRole('superadmin'), updateDevice);
router.patch('/:di/status', authenticate, requireRole('superadmin'), updateDeviceStatus);
router.delete('/delete/:di', authenticate, requireRole('superadmin'), deleteDevice);

// Device assignment routes
router.post('/assignUser/:deviceId', authenticate, requireRole('superadmin'), assignDeviceToUser);
router.post('/unassignUser/:deviceId', authenticate, requireRole('superadmin'), unassignDeviceFromUser);

export default router;