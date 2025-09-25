import express from 'express';
import { upsertMapping, listMappings, getMapping, updateMapping, deleteMapping } from '../controllers/notifications.controller.js';

const router = express.Router();
// More descriptive routes
router.post('/mapping/upsert', upsertMapping);
router.get('/mapping/fetch-all', listMappings);
router.get('/mapping/:di', getMapping);
router.put('/mapping/update/:di', updateMapping);
router.delete('/mapping/delete/:di', deleteMapping);
export default router;