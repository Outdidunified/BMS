import { ObjectId } from 'mongodb';

function normalizeObjectId(value, fieldName) {
    if (!value) {
        throw new Error(`${fieldName} is required`);
    }

    if (value instanceof ObjectId) {
        return value;
    }

    if (!ObjectId.isValid(value)) {
        throw new Error(`Invalid ${fieldName}`);
    }

    return new ObjectId(value);
}

function normalizeDate(value, fieldName) {
    const dateValue = value instanceof Date ? value : new Date(value ?? Date.now());

    if (Number.isNaN(dateValue.getTime())) {
        throw new Error(`${fieldName} must be a valid date`);
    }

    return dateValue;
}

export default class DeviceAssignment {
    constructor(db) {
        this.collection = db.collection('device_assignments');
        this.indexesEnsured = false;
    }

    async ensureIndexes() {
        if (this.indexesEnsured) {
            return;
        }

        await this.collection.createIndex(
            { userId: 1, deviceId: 1, unassignedAt: 1 },
            {
                unique: true,
                name: 'unique_active_user_device',
                partialFilterExpression: { unassignedAt: null },
            }
        );

        await this.collection.createIndex(
            { userId: 1, unassignedAt: 1, assignedAt: -1 },
            { name: 'user_active_device_assignments' }
        );

        await this.collection.createIndex(
            { deviceId: 1, unassignedAt: 1, assignedAt: -1 },
            { name: 'device_active_assignments' }
        );

        this.indexesEnsured = true;
    }

    async createAssignment({
        userId,
        deviceId,
        assignedAt,
    }) {
        await this.ensureIndexes();

        const now = normalizeDate(assignedAt, 'assignedAt');

        // deviceId is stored as string (not ObjectId)
        if (!deviceId || typeof deviceId !== 'string') {
            throw new Error('deviceId must be a non-empty string');
        }

        const assignment = {
            userId: normalizeObjectId(userId, 'userId'),
            deviceId: deviceId,
            assignedAt: now,
            unassignedAt: null,
            createdAt: now,
            updatedAt: now,
        };

        const result = await this.collection.insertOne(assignment);
        return { _id: result.insertedId, ...assignment };
    }

    async closeAssignment(assignmentId, unassignedAt = new Date()) {
        const normalizedAssignmentId = normalizeObjectId(assignmentId, 'assignmentId');
        const closingDate = normalizeDate(unassignedAt, 'unassignedAt');

        const result = await this.collection.findOneAndUpdate(
            { _id: normalizedAssignmentId, unassignedAt: null },
            {
                $set: {
                    unassignedAt: closingDate,
                    updatedAt: new Date(),
                },
            },
            { returnDocument: 'after' }
        );

        return result?.value ?? null;
    }

    async listByUser(userId, { includeInactive = false } = {}) {
        const normalizedUserId = normalizeObjectId(userId, 'userId');
        const filter = { userId: normalizedUserId };

        if (!includeInactive) {
            filter.unassignedAt = null;
        }

        return await this.collection
            .find(filter)
            .sort({ assignedAt: -1 })
            .toArray();
    }

    async listByDevice(deviceId, { includeInactive = false } = {}) {
        if (!deviceId || typeof deviceId !== 'string') {
            throw new Error('deviceId must be a non-empty string');
        }

        const filter = { deviceId };

        if (!includeInactive) {
            filter.unassignedAt = null;
        }

        return await this.collection
            .find(filter)
            .sort({ assignedAt: -1 })
            .toArray();
    }

    async findActiveAssignment(userId, deviceId) {
        const normalizedUserId = normalizeObjectId(userId, 'userId');

        if (!deviceId || typeof deviceId !== 'string') {
            throw new Error('deviceId must be a non-empty string');
        }

        return await this.collection.findOne({
            userId: normalizedUserId,
            deviceId: deviceId,
            unassignedAt: null,
        });
    }

    async findActiveAssignmentByUser(userId) {
        const normalizedUserId = normalizeObjectId(userId, 'userId');

        return await this.collection.findOne({
            userId: normalizedUserId,
            unassignedAt: null,
        });
    }

    async findActiveAssignmentByDevice(deviceId) {
        if (!deviceId || typeof deviceId !== 'string') {
            throw new Error('deviceId must be a non-empty string');
        }

        return await this.collection.findOne({
            deviceId: deviceId,
            unassignedAt: null,
        });
    }

    async deactivateAssignmentsByDevice(deviceId, unassignedAt = new Date()) {
        if (!deviceId || typeof deviceId !== 'string') {
            throw new Error('deviceId must be a non-empty string');
        }

        const closingDate = normalizeDate(unassignedAt, 'unassignedAt');

        const { modifiedCount } = await this.collection.updateMany(
            { deviceId: deviceId, unassignedAt: null },
            {
                $set: {
                    unassignedAt: closingDate,
                    updatedAt: new Date(),
                },
            }
        );

        return modifiedCount;
    }

    async deactivateAssignmentsByUser(userId, unassignedAt = new Date()) {
        const normalizedUserId = normalizeObjectId(userId, 'userId');
        const closingDate = normalizeDate(unassignedAt, 'unassignedAt');

        const { modifiedCount } = await this.collection.updateMany(
            { userId: normalizedUserId, unassignedAt: null },
            {
                $set: {
                    unassignedAt: closingDate,
                    updatedAt: new Date(),
                },
            }
        );

        return modifiedCount;
    }
}