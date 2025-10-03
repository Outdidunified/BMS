import express from 'express';
import {
    register,
    login,
    getUsers,
    updateUser,
    deleteUser,
    getProfile,
} from '../controllers/auth.controller.js';
import { authenticate, authorize, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/register', register); // Only for initial setup or by super_admin
router.post('/login', login);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.get('/users', authenticate, requireRole('superadmin'), getUsers);
router.put('/users/:id', authenticate, requireRole('superadmin'), updateUser);
router.delete('/users/:id', authenticate, requireRole('superadmin'), deleteUser);

export default router;