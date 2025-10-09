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

function normalizeNumber(value, fieldName) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        throw new Error(`${fieldName} must be a finite number`);
    }

    return numericValue;
}

function normalizeDate(value, fieldName) {
    const dateValue = value instanceof Date ? value : new Date(value ?? Date.now());

    if (Number.isNaN(dateValue.getTime())) {
        throw new Error(`${fieldName} must be a valid date`);
    }

    return dateValue;
}

export default class StationAssignment {
    constructor(db) {
        this.collection = db.collection('station_assignments');
        this.indexesEnsured = false;
    }

    async ensureIndexes() {
        if (this.indexesEnsured) {
            return;
        }

        await this.collection.createIndex(
            { userId: 1, stationId: 1, unassignedAt: 1 },
            {
                unique: true,
                name: 'unique_active_user_station',
                partialFilterExpression: { unassignedAt: null },
            }
        );

        await this.collection.createIndex(
            { userId: 1, unassignedAt: 1, assignedAt: -1 },
            { name: 'user_active_assignments' }
        );

        await this.collection.createIndex(
            { stationId: 1, unassignedAt: 1, assignedAt: -1 },
            { name: 'station_active_assignments' }
        );

        this.indexesEnsured = true;
    }

    async createAssignment({
        userId,
        stationId,
        stationNumber,
        roleId,
        roleName = null,
        assignedAt,
    }) {
        await this.ensureIndexes();

        const now = normalizeDate(assignedAt, 'assignedAt');

        const assignment = {
            userId: normalizeObjectId(userId, 'userId'),
            stationId: normalizeObjectId(stationId, 'stationId'),
            stationNumber: normalizeNumber(stationNumber, 'stationNumber'),
            roleId: normalizeNumber(roleId, 'roleId'),
            roleName: roleName ?? null,
            assignedAt: now,
            unassignedAt: null,
            createdAt: now,
            updatedAt: now,
        };

        if (assignment.roleName !== null && typeof assignment.roleName !== 'string') {
            throw new Error('roleName must be a string when provided');
        }

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

    async listByStation(stationId, { includeInactive = false } = {}) {
        const normalizedStationId = normalizeObjectId(stationId, 'stationId');
        const filter = { stationId: normalizedStationId };

        if (!includeInactive) {
            filter.unassignedAt = null;
        }

        return await this.collection
            .find(filter)
            .sort({ assignedAt: -1 })
            .toArray();
    }

    async findActiveAssignment(userId, stationId) {
        const normalizedUserId = normalizeObjectId(userId, 'userId');
        const normalizedStationId = normalizeObjectId(stationId, 'stationId');

        return await this.collection.findOne({
            userId: normalizedUserId,
            stationId: normalizedStationId,
            unassignedAt: null,
        });
    }

    async deactivateAssignmentsByStation(stationId, unassignedAt = new Date()) {
        const normalizedStationId = normalizeObjectId(stationId, 'stationId');
        const closingDate = normalizeDate(unassignedAt, 'unassignedAt');

        const { modifiedCount } = await this.collection.updateMany(
            { stationId: normalizedStationId, unassignedAt: null },
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