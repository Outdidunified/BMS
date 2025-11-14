import express from 'express';
import { analytics } from '../controllers/analytics.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();
// More descriptive route
router.get('/summary', authenticate, authorize('view_analytics'), analytics);
export default router;