import { connectDB, getDb } from '../config/db.js';
import User from '../data/User.model.js';
import Role from '../data/Role.model.js';
import logger from '../utils/logger.js';

async function seedInitialData() {
    try {
        await connectDB();
        const db = getDb();
        const userModel = new User(db);
        const roleModel = new Role(db);

        // Seed roles
        const roles = [
            {
                name: 'superadmin',
                permissions: {
                    manage_users: true,
                    view_devices: true,
                    manage_devices: true,
                    view_telemetry: true,
                    view_analytics: true,
                    manage_notifications: true,
                    view_dashboard: true
                },
                status: true
            },
            {
                name: 'stationmaster',
                permissions: {
                    view_devices: true,
                    view_telemetry: true,
                    view_dashboard: true
                },
                status: true
            }
        ];

        for (const roleData of roles) {
            const existingRole = await roleModel.findByName(roleData.name);
            if (!existingRole) {
                await roleModel.create(roleData);
                logger.loggerInfo(`Role created: ${roleData.name}`);
            } else {
                // Update existing role to add role_id if missing or update permissions
                const updates = {};
                if (!existingRole.role_id) {
                    updates.role_id = await roleModel.getNextRoleId();
                }
                if (JSON.stringify(existingRole.permissions) !== JSON.stringify(roleData.permissions)) {
                    updates.permissions = roleData.permissions;
                }
                if (Object.keys(updates).length > 0) {
                    await roleModel.update(existingRole._id.toString(), updates);
                    logger.loggerInfo(`Role updated: ${roleData.name}`);
                } else {
                    logger.loggerInfo(`Role already exists: ${roleData.name}`);
                }
            }
        }

        // Get superadmin role first
        const superAdminRole = await roleModel.findByName('superadmin');
        if (!superAdminRole) {
            logger.loggerError('Superadmin role not found');
            return;
        }

        // Check if super admin already exists
        const existingAdmin = await userModel.findByUsername('superadmin');
        if (existingAdmin) {
            const updates = {};
            if (typeof existingAdmin.role_id !== 'number') {
                updates.role_id = superAdminRole.role_id;
            }
            if (!existingAdmin.user_id) {
                updates.user_id = (await import('crypto')).randomUUID();
            }

            if (Object.keys(updates).length > 0) {
                await userModel.update(existingAdmin._id.toString(), updates);
                logger.loggerInfo('Super admin user updated with missing fields');
            } else {
                logger.loggerInfo('Super admin user already exists');
            }
            return;
        }

        // Plain text password as requested
        const plainPassword = 'superadmin@gmail.com';

        const superAdmin = await userModel.create({
            username: 'superadmin',
            email: 'superadmin@gmail.com',
            password: plainPassword, // Plain text, no hashing
            role_id: superAdminRole.role_id,
        });

        logger.loggerInfo(`Initial super admin user created: ${superAdmin.username}`);
    } catch (error) {
        logger.loggerError(`Error seeding initial data: ${error.message}`);
    } finally {
        process.exit(0);
    }
}

seedInitialData();