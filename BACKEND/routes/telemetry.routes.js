import express from 'express';
import { latestTelemetry, rangeTelemetry, batteryStateReport } from '../controllers/telemetry.controller.js';

const thz = express.Router();

thz.get('/latest', latestTelemetry);
thz.get('/range', rangeTelemetry);
thz.get('/battery-state-report', batteryStateReport);

export default thz;