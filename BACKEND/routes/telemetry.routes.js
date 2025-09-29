import express from 'express';
import { latestTelemetry, rangeTelemetry, batteryStateReport, batteryStateExport } from '../controllers/telemetry.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const thz = express.Router();

thz.get('/latest', authenticate, authorize('view_telemetry'), latestTelemetry);
thz.get('/range', authenticate, authorize('view_telemetry'), rangeTelemetry);
thz.get('/battery-state-report', authenticate, authorize('view_telemetry'), batteryStateReport);
thz.get('/battery-state-export', authenticate, authorize('view_telemetry'), batteryStateExport);

export default thz;