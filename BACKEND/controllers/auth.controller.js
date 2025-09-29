import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import User from '../data/User.model.js';
import Role from '../data/Role.model.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const register = async (req, res) => {
    try {
        const { username, email, password, role_id } = req.body;

        if (!username || !email || !password) {
            return res.fail('Username, email, and password are required', 400);
        }

        // Only superadmin can create users
        if (req.user && req.user.role !== 'superadmin') {
            return res.fail('Only super admin can create users', 403);
        }

        const db = getDb();
        const userModel = new User(db);
        const roleModel = new Role(db);

        // Check if user already exists
        const existingUser = await userModel.findByUsername(username);
        if (existingUser) {
            return res.fail('Username already exists', 400);
        }

        const existingEmail = await userModel.findByEmail(email);
        if (existingEmail) {
            return res.fail('Email already exists', 400);
        }

        // Get role_id - default to stationmaster if not provided
        let userRoleId = role_id;
        if (!userRoleId) {
            const defaultRole = await roleModel.findByName('stationmaster');
            if (!defaultRole) {
                return res.fail('Default role not found. Please create roles first.', 500);
            }
            userRoleId = defaultRole.role_id;
        }

        // Verify role exists
        const role = await roleModel.findByRoleId(userRoleId);
        if (!role) {
            return res.fail('Invalid role', 400);
        }

        // Plain text password (no hashing as requested)
        const newUser = await userModel.create({
            username,
            email,
            password: password, // Plain text
            role_id: Number(userRoleId),
        });

        // Don't return password
        const { password: _, ...userWithoutPassword } = newUser;

        logger.loggerInfo(`User ${username} registered successfully`);
        res.ok(userWithoutPassword, 'User created successfully');
    } catch (error) {
        logger.loggerError(`Register error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.fail('Email and password are required', 400);
        }

        const db = getDb();
        const userModel = new User(db);
        const user = await userModel.findByEmail(email);

        if (!user) {
            return res.fail('Invalid credentials', 401);
        }

        // Check password (plain text comparison)
        if (password !== user.password) {
            return res.fail('Invalid credentials', 401);
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user._id.toString(), email: user.email, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const { password: _, ...userWithoutPassword } = user;

        logger.loggerInfo(`User ${user.username} logged in`);
        res.ok(
            { user: userWithoutPassword, token },
            'Login successful'
        );
    } catch (error) {
        logger.loggerError(`Login error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const getUsers = async (req, res) => {
    try {
        const db = getDb();
        const userModel = new User(db);
        const users = await userModel.findAll();

        // Remove passwords
        const usersWithoutPasswords = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.ok(usersWithoutPasswords, 'Users retrieved successfully');
    } catch (error) {
        logger.loggerError(`Get users error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_id } = req.body;

        const db = getDb();
        const userModel = new User(db);
        const roleModel = new Role(db);

        // Only superadmin can update users
        if (req.user.role !== 'superadmin') {
            return res.fail('Only super admin can update users', 403);
        }

        const updateData = {};
        if (role_id) {
            // Verify role exists
            const role = await roleModel.findByRoleId(role_id);
            if (!role) {
                return res.fail('Invalid role', 400);
            }
            updateData.role_id = Number(role_id);
        }

        const success = await userModel.update(id, updateData);

        if (!success) {
            return res.fail('User not found or no changes made', 404);
        }

        logger.loggerInfo(`User ${id} updated successfully`);
        res.ok({}, 'User updated successfully');
    } catch (error) {
        logger.loggerError(`Update user error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const db = getDb();
        const userModel = new User(db);

        // Only superadmin can delete users
        if (req.user.role !== 'superadmin') {
            return res.fail('Only super admin can delete users', 403);
        }

        const success = await userModel.delete(id);

        if (!success) {
            return res.fail('User not found', 404);
        }

        logger.loggerInfo(`User ${id} deleted successfully`);
        res.ok({}, 'User deleted successfully');
    } catch (error) {
        logger.loggerError(`Delete user error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const getProfile = async (req, res) => {
    try {
        const { userId } = req.query;

        if (userId) {
            // Fetch specific user's profile - only superadmin allowed
            if (req.user.role !== 'superadmin') {
                return res.fail('Only superadmin can view other users\' profiles', 403);
            }

            const db = getDb();
            const userModel = new User(db);
            const roleModel = new Role(db);

            const user = await userModel.findById(userId);
            if (!user) {
                return res.fail('User not found', 404);
            }

            const role = await roleModel.findByRoleId(user.role_id);
            if (!role) {
                return res.fail('User role not found', 500);
            }

            const { password, ...userWithoutPassword } = user;
            const profileData = {
                ...userWithoutPassword,
                role: role.name,
                permissions: role.permissions,
            };

            res.ok(profileData, 'Profile retrieved successfully');
        } else {
            // Fetch own profile
            const { password, ...userWithoutPassword } = req.user;
            res.ok(userWithoutPassword, 'Profile retrieved successfully');
        }
    } catch (error) {
        logger.loggerError(`Get profile error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

