import express from 'express';
import { createDevice, listDevices, updateDevice, deleteDevice, getDevice, updateDeviceStatus } from '../controllers/devices.controller.js';
import { authenticate, authorize, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();
// More descriptive routes
router.post('/create', authenticate, requireRole('super_admin'), createDevice);
router.get('/fetch-all', authenticate, authorize('view_devices'), listDevices);
router.get('/:di', authenticate, authorize('view_devices'), getDevice);
router.put('/update/:di', authenticate, requireRole('super_admin'), updateDevice);
router.patch('/:di/status', authenticate, requireRole('super_admin'), updateDeviceStatus);
router.delete('/delete/:di', authenticate, requireRole('super_admin'), deleteDevice);
export default router;