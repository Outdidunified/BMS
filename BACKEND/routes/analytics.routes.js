import express from 'express';
import { analytics } from '../controllers/analytics.controller.js';

const router = express.Router();
// More descriptive route
router.get('/summary', analytics);
export default router;