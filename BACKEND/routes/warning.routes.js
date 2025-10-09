import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
    getStationWarnings,
    upsertStationWarnings,
    patchStationWarningCategory,
    deleteStationWarningCategory,
} from '../controllers/warning.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Station-scoped warnings
router.get('/getWarnings/:stationId', getStationWarnings);
router.put('/createWarning/:stationId', upsertStationWarnings);
router.patch('/updateWarning/:stationId/:category', patchStationWarningCategory);
router.delete('/deleteWarning/:stationId/:category', deleteStationWarningCategory);

export default router;