import express from 'express';
import {
    register,
    login,
    getUsers,
    updateUser,
    deleteUser,
    getProfile,
    updateProfile,
} from '../controllers/auth.controller.js';
import { authenticate, authorize, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/register', register); // Only for initial setup or by super_admin
router.post('/login', login);

// Protected routes
router.get('/getProfile', authenticate, getProfile);
router.put('/updateProfile', authenticate, updateProfile);
router.get('/getUsers', authenticate, requireRole('superadmin'), getUsers);
router.put('/updateUser/:id', authenticate, requireRole('superadmin'), updateUser);
router.delete('/deleteUser/:id', authenticate, requireRole('superadmin'), deleteUser);

export default router;