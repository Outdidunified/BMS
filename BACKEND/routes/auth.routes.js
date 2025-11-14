import express from 'express';
import {
    register,
    login,
    getUsers,
    getActiveUsers,
    updateUser,
    updateUserStatus,
    getProfile,
    updateProfile,
} from '../controllers/auth.controller.js';
import { authenticate, authorize, requireRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/getProfile', authenticate, getProfile);
router.put('/updateProfile', authenticate, updateProfile);
router.post('/CreateUser', authenticate, requireRole('superadmin'), register);
router.get('/getUsers', authenticate, requireRole('superadmin'), getUsers);
router.get('/getActiveUsers', authenticate, requireRole('superadmin'), getActiveUsers);
router.put('/updateUser/:id', authenticate, requireRole('superadmin'), updateUser);
router.put('/deactivateuser/:id', authenticate, requireRole('superadmin'), updateUserStatus);

export default router;