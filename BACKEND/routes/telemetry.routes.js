import express from 'express';
import { latestTelemetry, rangeTelemetry } from '../controllers/telemetry.controller.js';

const router = express.Router();

router.get('/latest', latestTelemetry);
router.get('/range', rangeTelemetry);

export default router;