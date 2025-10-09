import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import Station from '../data/Station.model.js';
import logger from '../utils/logger.js';

const warningCategories = new Set(['cellVoltage', 'temperature', 'current']);

function isValidObjectId(id) {
    return ObjectId.isValid(id);
}

function buildWarningResponse(station, stationId) {
    return {
        stationId,
        warnings: station?.warnings || {},
    };
}

function validateCategoryPayload(category, payload) {
    if (!payload || typeof payload !== 'object') {
        return 'Payload must be an object';
    }

    const numericFields = ['high', 'low', 'checkInterval'];
    for (const field of numericFields) {
        if (payload[field] !== undefined && typeof payload[field] !== 'number') {
            return `${field} must be a number`;
        }
    }

    if (payload.high !== undefined && payload.low !== undefined && payload.low > payload.high) {
        return 'low cannot be greater than high';
    }

    if (payload.checkInterval !== undefined && payload.checkInterval < 0) {
        return 'checkInterval must be non-negative';
    }

    return null;
}

function ensureStationAccess(req, stationId) {
    if (req.user.role === 'superadmin') {
        return true;
    }

    const normalizedStationId = stationId.toString();

    if (req.user.role === 'stationmaster' && Array.isArray(req.user.stations)) {
        return req.user.stations.includes(normalizedStationId);
    }

    return false;
}

export const getStationWarnings = async (req, res) => {
    try {
        const { stationId } = req.params;

        if (!stationId || !isValidObjectId(stationId)) {
            return res.fail('Valid stationId is required', 400);
        }

        if (!ensureStationAccess(req, stationId)) {
            return res.fail('Unauthorized', 403);
        }

        const db = getDb();
        const stationModel = new Station(db);

        const station = await stationModel.findById(stationId);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        res.ok(buildWarningResponse(station, stationId), 'Station warnings retrieved successfully');
    } catch (error) {
        logger.loggerError(`Get station warnings error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const upsertStationWarnings = async (req, res) => {
    try {
        const { stationId } = req.params;
        const { warnings } = req.body || {};

        if (!stationId || !isValidObjectId(stationId)) {
            return res.fail('Valid stationId is required', 400);
        }

        if (!warnings || typeof warnings !== 'object') {
            return res.fail('warnings payload must be provided', 400);
        }

        if (!ensureStationAccess(req, stationId)) {
            return res.fail('Unauthorized', 403);
        }

        const db = getDb();
        const stationModel = new Station(db);

        const station = await stationModel.findById(stationId);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        const sanitizedWarnings = {};
        for (const [category, payload] of Object.entries(warnings)) {
            if (!warningCategories.has(category)) {
                continue;
            }
            const validationError = validateCategoryPayload(category, payload);
            if (validationError) {
                return res.fail(`Invalid ${category} payload: ${validationError}`, 400);
            }
            sanitizedWarnings[category] = { ...payload };
        }

        const updateResult = await stationModel.collection.updateOne(
            { _id: new ObjectId(stationId) },
            {
                $set: {
                    warnings: sanitizedWarnings,
                    updatedAt: new Date(),
                },
            }
        );

        if (!updateResult.matchedCount) {
            return res.fail('Station not found', 404);
        }

        logger.loggerInfo(`Warnings for station ${stationId} upserted`);
        res.ok(buildWarningResponse({ warnings: sanitizedWarnings }, stationId), 'Station warnings updated successfully');
    } catch (error) {
        logger.loggerError(`Upsert station warnings error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const patchStationWarningCategory = async (req, res) => {
    try {
        const { stationId, category } = req.params;
        const payload = req.body || {};

        if (!stationId || !isValidObjectId(stationId)) {
            return res.fail('Valid stationId is required', 400);
        }

        if (!category || !warningCategories.has(category)) {
            return res.fail('Invalid warning category', 400);
        }

        if (!ensureStationAccess(req, stationId)) {
            return res.fail('Unauthorized', 403);
        }

        const validationError = validateCategoryPayload(category, payload);
        if (validationError) {
            return res.fail(`Invalid ${category} payload: ${validationError}`, 400);
        }

        const db = getDb();
        const stationModel = new Station(db);

        const station = await stationModel.findById(stationId);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        const nextWarnings = {
            ...(station.warnings || {}),
            [category]: { ...payload },
        };

        await stationModel.collection.updateOne(
            { _id: new ObjectId(stationId) },
            {
                $set: {
                    warnings: nextWarnings,
                    updatedAt: new Date(),
                },
            }
        );

        logger.loggerInfo(`Warning category ${category} updated for station ${stationId}`);
        res.ok(buildWarningResponse({ warnings: nextWarnings }, stationId), 'Station warning category updated successfully');
    } catch (error) {
        logger.loggerError(`Patch station warning category error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};

export const deleteStationWarningCategory = async (req, res) => {
    try {
        const { stationId, category } = req.params;

        if (!stationId || !isValidObjectId(stationId)) {
            return res.fail('Valid stationId is required', 400);
        }

        if (!category || !warningCategories.has(category)) {
            return res.fail('Invalid warning category', 400);
        }

        if (!ensureStationAccess(req, stationId)) {
            return res.fail('Unauthorized', 403);
        }

        const db = getDb();
        const stationModel = new Station(db);

        const station = await stationModel.findById(stationId);
        if (!station) {
            return res.fail('Station not found', 404);
        }

        if (!station.warnings || !station.warnings[category]) {
            return res.fail('Warning category not configured', 404);
        }

        const nextWarnings = { ...station.warnings };
        delete nextWarnings[category];

        await stationModel.collection.updateOne(
            { _id: new ObjectId(stationId) },
            {
                $set: {
                    warnings: nextWarnings,
                    updatedAt: new Date(),
                },
            }
        );

        logger.loggerInfo(`Warning category ${category} removed for station ${stationId}`);
        res.ok(buildWarningResponse({ warnings: nextWarnings }, stationId), 'Station warning category deleted successfully');
    } catch (error) {
        logger.loggerError(`Delete station warning category error: ${error.message}`);
        res.fail('Internal server error', 500);
    }
};