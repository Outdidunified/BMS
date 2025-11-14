import express from 'express';
import {
    dashboardSummary,
    getBatteryVoltageTrendChart,
    getChartData,
    getCurrentTrendChart,
    getDeviceStatusChart,
    getTemperatureTrendChart,
    getWarningsSummaryChart
} from '../controllers/dashboard.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Dashboard summary
router.get('/summary', authenticate, authorize('view_dashboard'), dashboardSummary);

// Dashboard chart data (deprecated, kept for backward compatibility)
router.get('/charts', authenticate, authorize('view_dashboard'), getChartData);

// Dashboard chart slices
router.get('/device-status', authenticate, authorize('view_dashboard'), getDeviceStatusChart);
router.get('/battery-voltage', authenticate, authorize('view_dashboard'), getBatteryVoltageTrendChart);
router.get('/temperature-trend', authenticate, authorize('view_dashboard'), getTemperatureTrendChart);
router.get('/current-trend', authenticate, authorize('view_dashboard'), getCurrentTrendChart);
router.get('/warnings-summary', authenticate, authorize('view_dashboard'), getWarningsSummaryChart);

export default router;