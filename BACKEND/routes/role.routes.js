import express from 'express';
import {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    getActiveRoles
} from '../controllers/role.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All role routes require authentication and superadmin role
router.use(authenticate);
router.use(requireRole('superadmin'));

router.get('/', getAllRoles);
router.get('/active', getActiveRoles);
router.get('/:id', getRoleById);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

export default router;