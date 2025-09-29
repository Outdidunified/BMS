import express from 'express';
import { latestTelemetry, rangeTelemetry, batteryStateReport, batteryStateExport } from '../controllers/telemetry.controller.js';

const thz = express.Router();

thz.get('/latest', latestTelemetry);
thz.get('/range', rangeTelemetry);
thz.get('/battery-state-report', batteryStateReport);
thz.get('/battery-state-export', batteryStateExport);

export default thz;