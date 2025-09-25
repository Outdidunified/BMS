import express from 'express';
import { createDevice, listDevices, updateDevice, deleteDevice, getDevice, updateDeviceStatus } from '../controllers/devices.controller.js';

const router = express.Router();
// More descriptive routes
router.post('/create', createDevice);
router.get('/fetch-all', listDevices);
router.get('/:di', getDevice);
router.put('/update/:di', updateDevice);
router.patch('/:di/status', updateDeviceStatus);
router.delete('/delete/:di', deleteDevice);
export default router;