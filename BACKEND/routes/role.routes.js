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

router.get('/getRoles', getAllRoles);
router.get('/getActiveRoles', getActiveRoles);
router.get('/getRole/:id', getRoleById);
router.post('/createRole', createRole);
router.put('/updateRole/:id', updateRole);
router.delete('/deleteRole/:id', deleteRole);

export default router;