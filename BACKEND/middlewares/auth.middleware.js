import jwt from 'jsonwebtoken';
import { getDb } from '../config/db.js';
import User from '../data/User.model.js';
import Role from '../data/Role.model.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.fail('Access token required', 401);
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);

        const db = getDb();
        const userModel = new User(db);
        const user = await userModel.findById(decoded.id);

        if (!user) {
            return res.fail('User not found', 401);
        }

        // Fetch role details
        const roleModel = new Role(db);
        const role = await roleModel.findByRoleId(user.role_id);

        if (!role) {
            return res.fail('Role not found', 401);
        }

        req.user = {
            ...user,
            role: role.name,
            permissions: role.permissions
        };
        next();
    } catch (error) {
        logger.loggerError(`Auth middleware error: ${error.message}`);
        return res.fail('Invalid token', 401);
    }
};

export const authorize = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.fail('Authentication required', 401);
        }

        // Superadmin has all permissions
        if (req.user.role === 'superadmin') {
            return next();
        }

        // Check if user has all required permissions
        const hasPermission = requiredPermissions.every(permission =>
            req.user.permissions.includes(permission)
        );

        if (!hasPermission) {
            return res.fail('Insufficient permissions', 403);
        }

        next();
    };
};

export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.fail('Authentication required', 401);
        }

        if (!roles.includes(req.user.role)) {
            return res.fail('Insufficient role', 403);
        }

        next();
    };
};