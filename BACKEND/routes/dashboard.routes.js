import express from 'express';
import { dashboardSummary, getChartData } from '../controllers/dashboard.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Dashboard summary
router.get('/summary', authenticate, authorize('view_dashboard'), dashboardSummary);

// Dashboard chart data
router.get('/charts', authenticate, authorize('view_dashboard'), getChartData);

export default router;