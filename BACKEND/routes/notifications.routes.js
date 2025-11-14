import express from 'express';
import { upsertMapping, listMappings, getMapping, updateMapping, deleteMapping, deleteSpecificEmail } from '../controllers/notifications.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();
// More descriptive routes
router.post('/mapping/upsert', authenticate, authorize('manage_notifications'), upsertMapping);
router.get('/mapping/fetch-all', authenticate, authorize('manage_notifications'), listMappings);
router.get('/mapping/:di', authenticate, authorize('manage_notifications'), getMapping);
router.put('/mapping/update/:di', authenticate, authorize('manage_notifications'), updateMapping);
router.delete('/mapping/delete/:di', authenticate, authorize('manage_notifications'), deleteMapping);
router.delete('/mapping/delete-email/:di/:email', authenticate, authorize('manage_notifications'), deleteSpecificEmail);
export default router;