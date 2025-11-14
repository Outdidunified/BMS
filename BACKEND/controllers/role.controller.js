import { getDb } from '../config/db.js';
import Role from '../data/Role.model.js';
import logger from '../utils/logger.js';

export const getAllRoles = async (req, res) => {
    try {
        const db = getDb();
        const roleModel = new Role(db);
        const roles = await roleModel.findAll();
        res.ok(roles);
    } catch (error) {
        logger.loggerError(`Get all roles error: ${error.message}`);
        res.fail('Failed to fetch roles', 500);
    }
};

export const getRoleById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();
        const roleModel = new Role(db);
        const role = await roleModel.findById(id);

        if (!role) {
            return res.fail('Role not found', 404);
        }

        res.ok(role);
    } catch (error) {
        logger.loggerError(`Get role by ID error: ${error.message}`);
        res.fail('Failed to fetch role', 500);
    }
};

export const createRole = async (req, res) => {
    try {
        const { name, permissions, status } = req.body;

        if (!name) {
            return res.fail('Role name is required', 400);
        }

        const db = getDb();
        const roleModel = new Role(db);

        // Check if role name already exists
        const existingRole = await roleModel.findByName(name);
        if (existingRole) {
            return res.fail('Role name already exists', 400);
        }

        const roleData = {
            name,
            permissions: permissions || {},
            status: status !== undefined ? status : true
        };

        const role = await roleModel.create(roleData);
        logger.loggerInfo(`Role created: ${role.name}`);
        res.ok(role, 'Role created successfully', 201);
    } catch (error) {
        logger.loggerError(`Create role error: ${error.message}`);
        res.fail('Failed to create role', 500);
    }
};

export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, permissions, status } = req.body;

        const db = getDb();
        const roleModel = new Role(db);

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (permissions !== undefined) updateData.permissions = permissions;
        if (status !== undefined) updateData.status = status;

        const success = await roleModel.update(id, updateData);

        if (!success) {
            return res.fail('Role not found or no changes made', 404);
        }

        const updatedRole = await roleModel.findById(id);
        logger.loggerInfo(`Role updated: ${updatedRole.name}`);
        res.ok(updatedRole);
    } catch (error) {
        logger.loggerError(`Update role error: ${error.message}`);
        res.fail('Failed to update role', 500);
    }
};

export const deactivateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (status === undefined) {
            return res.fail('Status is required', 400);
        }

        const db = getDb();
        const roleModel = new Role(db);

        const updateData = { status };

        const success = await roleModel.update(id, updateData);

        if (!success) {
            return res.fail('Role not found', 404);
        }

        const updatedRole = await roleModel.findById(id);
        logger.loggerInfo(`Role ${status ? 'activated' : 'deactivated'}: ${updatedRole.name}`);
        res.ok(updatedRole);
    } catch (error) {
        logger.loggerError(`Deactivate role error: ${error.message}`);
        res.fail('Failed to update role status', 500);
    }
};

export const getActiveRoles = async (req, res) => {
    try {
        const db = getDb();
        const roleModel = new Role(db);
        const roles = await roleModel.findActive();
        res.ok(roles);
    } catch (error) {
        logger.loggerError(`Get active roles error: ${error.message}`);
        res.fail('Failed to fetch active roles', 500);
    }
};