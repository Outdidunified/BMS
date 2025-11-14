import express from 'express';
import { ingestData } from '../controllers/data.controller.js';
import { authDevice } from '../middlewares/authDevice.js';

const router = express.Router();
router.post('/', authDevice, ingestData);
export default router;