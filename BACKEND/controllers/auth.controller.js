import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import User from '../data/User.model.js';
import Role from '../data/Role.model.js';
import Device from '../data/Device.model.js';
import DeviceAssignment from '../data/DeviceAssignment.model.js';
import Station from '../data/Station.model.js';
import StationAssignment from '../data/StationAssignment.model.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const register = async (req, res) => {
    try {
        const { username, email, password, role_id, station_id, device_id } = req.body;

        if (!username || !email || !password) {
            return res.fail('Username, email, and password are required', 400);
        }

        const db = getDb();
        const userModel = new User(db);
        const roleModel = new Role(db);
        const deviceAssignmentModel = new DeviceAssignment(db);
        const stationModel = new Station(db);
        const stationAssignmentModel = new StationAssignment(db);

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

        // If station_id is provided, verify station exists and is not already assigned
        let station = null;
        if (station_id) {
            station = await stationModel.findById(station_id);
            if (!station) {
                return res.fail('Station not found', 404);
            }

            // Check if station is already assigned to another user
            const existingStationAssignment = await stationAssignmentModel.findActiveAssignmentByStation(station._id);
            if (existingStationAssignment) {
                return res.fail('Station is already assigned to another user', 409);
            }
        }

        // If device_id is provided, verify device exists and is not already assigned
        let device = null;
        if (device_id) {
            device = await Device.findOne({ deviceId: device_id });
            if (!device) {
                return res.fail('Device not found', 404);
            }

            // Check if device is already assigned to another user
            const existingDeviceAssignment = await deviceAssignmentModel.findActiveAssignmentByDevice(device_id);
            if (existingDeviceAssignment) {
                return res.fail('Device is already assigned to another user', 409);
            }
        }

        // Plain text password (no hashing as requested)
        const newUser = await userModel.create({
            username,
            email,
            password: password, // Plain text
            role_id: Number(userRoleId),
            station_id: station_id ? new ObjectId(station_id) : undefined,
            device_id: device_id || undefined,
            assigned_device_id: device_id || undefined,
            status: true,
        });

        // If station_id is provided, create station assignment
        let stationAssignment = null;
        if (station_id && station) {
            try {
                stationAssignment = await stationAssignmentModel.createAssignment({
                    userId: newUser._id,
                    stationId: station._id,
                    stationNumber: station.station_id,
                    roleId: role.role_id,
                    roleName: role.name,
                    assignedAt: new Date(),
                });

                // Update user's assigned_station_ids array
                await userModel.update(newUser._id.toString(), {
                    assigned_station_ids: [
                        {
                            assignmentId: stationAssignment._id,
                            stationNumber: station.station_id,
                        },
                    ],
                });

                logger.loggerInfo(`Station ${station.name} (${station.station_id}) assigned to user ${username}`);
            } catch (stationError) {
                logger.loggerError(`Station assignment error during registration: ${stationError.message}`);
                // Continue with user creation even if station assignment fails
            }
        }

        // If device_id is provided, create device assignment
        let deviceAssignment = null;
        if (device_id && device) {
            try {
                deviceAssignment = await deviceAssignmentModel.createAssignment({
                    userId: newUser._id,
                    deviceId: device_id,
                    assignedAt: new Date(),
                });

                // Update device with user reference
                await Device.findOneAndUpdate(
                    { deviceId: device_id },
                    { user_id: newUser._id },
                    { new: true }
                );

                logger.loggerInfo(`Device ${device_id} assigned to user ${username}`);
            } catch (deviceError) {
                logger.loggerError(`Device assignment error during registration: ${deviceError.message}`);
                // Continue with user creation even if device assignment fails
            }
        }

        // Don't return password
        const { password: _, ...userWithoutPassword } = newUser;
        userWithoutPassword.user_id = newUser.user_id;

        const responseData = {
            user: userWithoutPassword,
        };

        if (stationAssignment) {
            responseData.stationAssignment = {
                id: stationAssignment._id.toString(),
                userId: stationAssignment.userId.toString(),
                stationId: stationAssignment.stationId.toString(),
                stationNumber: stationAssignment.stationNumber,
                roleId: stationAssignment.roleId,
                roleName: stationAssignment.roleName,
                assignedAt: stationAssignment.assignedAt,
            };
        }

        if (deviceAssignment) {
            responseData.deviceAssignment = {
                id: deviceAssignment._id.toString(),
                userId: deviceAssignment.userId.toString(),
                deviceId: deviceAssignment.deviceId,
                assignedAt: deviceAssignment.assignedAt,
            };
        }

        logger.loggerInfo(`User ${username} registered successfully`);
        res.ok(responseData, 'User created successfully');
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

        // Check if user is active
        if (user.status !== true) {
            return res.fail('Account is deactivated', 401);
        }

        // Check password (plain text comparison)
        if (password !== user.password) {
            return res.fail('Invalid credentials', 401);
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                username: user.username,
                user_id: user.user_id,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const { password: _, ...userWithoutPassword } = user;
        userWithoutPassword.user_id = user.user_id;

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

export const getActiveUsers = async (req, res) => {
    try {
        const db = getDb();
        const userModel = new User(db);
        const users = await userModel.findActive();

        // Remove passwords
        const usersWithoutPasswords = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.ok(usersWithoutPasswords, 'Active users retrieved successfully');
    } catch (error) {
        logger.loggerError(`Get active users error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_id, username, password } = req.body;

        const db = getDb();
        const userModel = new User(db);
        const roleModel = new Role(db);

        // Only superadmin can update users
        if (req.user.role !== 'superadmin') {
            return res.fail('Only super admin can update users', 403);
        }

        const updateData = {};
        if (username) {
            // Check username uniqueness
            const existingUser = await userModel.findByUsername(username);
            if (existingUser && existingUser._id.toString() !== id) {
                return res.fail('Username already exists', 400);
            }
            updateData.username = username;
        }
        if (password) {
            updateData.password = password; // Plain text
        }
        if (role_id) {
            // Verify role exists
            const role = await roleModel.findByRoleId(role_id);
            if (!role) {
                return res.fail('Invalid role', 400);
            }
            updateData.role_id = Number(role_id);
        }

        if (Object.keys(updateData).length === 0) {
            return res.fail('No fields to update', 400);
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

export const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (status === undefined) {
            return res.fail('Status is required', 400);
        }

        const db = getDb();
        const userModel = new User(db);

        // Only superadmin can update user status
        if (req.user.role !== 'superadmin') {
            return res.fail('Only super admin can update user status', 403);
        }

        const updateData = { status };
        const success = await userModel.update(id, updateData);

        if (!success) {
            return res.fail('User not found', 404);
        }

        const updatedUser = await userModel.findById(id);
        logger.loggerInfo(`User ${updatedUser.username} ${status ? 'activated' : 'deactivated'} successfully`);
        res.ok({}, `User ${status ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
        logger.loggerError(`Update user status error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const userId = req.user._id.toString();

        const db = getDb();
        const userModel = new User(db);

        const updateData = {};
        if (username) updateData.username = username;
        if (password) updateData.password = password; // plain text
        if (email) {
            // Check email uniqueness
            const existingEmail = await userModel.findByEmail(email);
            if (existingEmail && existingEmail._id.toString() !== userId) {
                return res.fail('Email already exists', 400);
            }
            updateData.email = email;
        }

        if (Object.keys(updateData).length === 0) {
            return res.fail('No fields to update', 400);
        }

        const success = await userModel.update(userId, updateData);
        if (!success) {
            return res.fail('Update failed', 500);
        }

        logger.loggerInfo(`Profile updated for user ${userId}`);
        res.ok({}, 'Profile updated successfully');
    } catch (error) {
        logger.loggerError(`Update profile error: ${error.message}`);
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
            userWithoutPassword.user_id = user.user_id;
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

