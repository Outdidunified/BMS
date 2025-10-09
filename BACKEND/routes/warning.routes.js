import express from 'express';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import {
    getStationWarnings,
    upsertStationWarnings,
    patchStationWarningCategory,
    deleteStationWarningCategory,
} from '../controllers/warning.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Station-scoped warnings - Superadmin and Stationmaster
router.get('/getWarnings/:stationId', requireRole('superadmin', 'stationmaster'), getStationWarnings);
router.post('/createWarning/:stationId', requireRole('superadmin', 'stationmaster'), upsertStationWarnings);
router.patch('/updateWarning/:stationId/:category', requireRole('superadmin', 'stationmaster'), patchStationWarningCategory);
router.delete('/deleteWarning/:stationId/:category', requireRole('superadmin', 'stationmaster'), deleteStationWarningCategory);

export default router;