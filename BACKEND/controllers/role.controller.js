import { getDb } from '../config/db.js';
import Role from '../data/Role.model.js';
import logger from '../utils/logger.js';

export const getAllRoles = async (req, res) => {
    try {
        const db = getDb();
        const roleModel = new Role(db);
        const roles = await roleModel.findAll();
        res.success(roles);
    } catch (error) {
        logger.loggerError(`Get all roles error: ${error.message}`);
        res.error('Failed to fetch roles', 500);
    }
};

export const getRoleById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();
        const roleModel = new Role(db);
        const role = await roleModel.findById(id);

        if (!role) {
            return res.error('Role not found', 404);
        }

        res.success(role);
    } catch (error) {
        logger.loggerError(`Get role by ID error: ${error.message}`);
        res.error('Failed to fetch role', 500);
    }
};

export const createRole = async (req, res) => {
    try {
        const { name, permissions, status } = req.body;

        if (!name) {
            return res.error('Role name is required', 400);
        }

        const db = getDb();
        const roleModel = new Role(db);

        // Check if role name already exists
        const existingRole = await roleModel.findByName(name);
        if (existingRole) {
            return res.error('Role name already exists', 400);
        }

        const roleData = {
            name,
            permissions: permissions || [],
            status: status !== undefined ? status : true
        };

        const role = await roleModel.create(roleData);
        logger.loggerInfo(`Role created: ${role.name}`);
        res.success(role, 201);
    } catch (error) {
        logger.loggerError(`Create role error: ${error.message}`);
        res.error('Failed to create role', 500);
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
            return res.error('Role not found or no changes made', 404);
        }

        const updatedRole = await roleModel.findById(id);
        logger.loggerInfo(`Role updated: ${updatedRole.name}`);
        res.success(updatedRole);
    } catch (error) {
        logger.loggerError(`Update role error: ${error.message}`);
        res.error('Failed to update role', 500);
    }
};

export const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();
        const roleModel = new Role(db);

        const success = await roleModel.delete(id);

        if (!success) {
            return res.error('Role not found', 404);
        }

        logger.loggerInfo(`Role deleted: ${id}`);
        res.success({ message: 'Role deleted successfully' });
    } catch (error) {
        logger.loggerError(`Delete role error: ${error.message}`);
        res.error(error.message, 400);
    }
};

export const getActiveRoles = async (req, res) => {
    try {
        const db = getDb();
        const roleModel = new Role(db);
        const roles = await roleModel.findActive();
        res.success(roles);
    } catch (error) {
        logger.loggerError(`Get active roles error: ${error.message}`);
        res.error('Failed to fetch active roles', 500);
    }
};