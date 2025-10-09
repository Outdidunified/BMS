import { randomUUID } from 'crypto';
import { ObjectId } from 'mongodb';

const UserSchema = {
    _id: ObjectId,
    user_id: String,
    username: String,
    email: String,
    password: String, // plain text
    role_id: Number, // reference to role.role_id
    station_id: ObjectId, // reference to station._id, optional for superadmin
    stations: [ObjectId], // multiple station assignments for stationmaster
    createdAt: Date,
    updatedAt: Date,
};

function buildUserFilter(id) {
    if (!id) {
        return null;
    }

    if (ObjectId.isValid(id)) {
        try {
            return { _id: new ObjectId(id) };
        } catch (error) {
            // Fall through to treat as user_id if ObjectId construction fails
        }
    }

    return { user_id: id };
}

function normalizeAssignedStationIds(values) {
    if (!Array.isArray(values)) {
        return [];
    }

    return values
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
            assignmentId: entry.assignmentId instanceof ObjectId ? entry.assignmentId : new ObjectId(entry.assignmentId),
            stationNumber: entry.stationNumber,
        }));
}

export default class User {
    constructor(db) {
        this.collection = db.collection('users');
    }

    async ensureUserPublicId(user) {
        if (!user) {
            return null;
        }

        if (!user.user_id) {
            const generatedId = randomUUID();
            await this.collection.updateOne(
                { _id: user._id },
                { $set: { user_id: generatedId, updatedAt: new Date() } }
            );
            user.user_id = generatedId;
        }

        return user;
    }

    async create(userData) {
        const user = {
            ...userData,
            user_id: userData.user_id || randomUUID(),
            stations: Array.isArray(userData.stations)
                ? userData.stations
                : userData.station_id
                    ? [userData.station_id]
                    : [],
            assigned_station_ids: Array.isArray(userData.assigned_station_ids)
                ? normalizeAssignedStationIds(userData.assigned_station_ids)
                : [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.collection.insertOne(user);
        return { _id: result.insertedId, ...user };
    }

    async findByUsername(username) {
        const user = await this.collection.findOne({ username });
        return await this.ensureUserPublicId(user);
    }

    async findByEmail(email) {
        const user = await this.collection.findOne({ email });
        return await this.ensureUserPublicId(user);
    }

    async findByUserId(userId) {
        if (!userId) {
            return null;
        }
        const user = await this.collection.findOne({ user_id: userId });
        return await this.ensureUserPublicId(user);
    }

    async findById(id) {
        const filter = buildUserFilter(id);
        if (!filter) {
            return null;
        }
        const user = await this.collection.findOne(filter);
        return await this.ensureUserPublicId(user);
    }

    async update(id, updateData) {
        const filter = buildUserFilter(id);
        if (!filter) {
            return false;
        }
        const result = await this.collection.updateOne(
            filter,
            { $set: { ...updateData, updatedAt: new Date() } }
        );
        return result.modifiedCount > 0;
    }

    async findAll() {
        return await this.collection.find({}).toArray();
    }

    async delete(id) {
        const filter = buildUserFilter(id);
        if (!filter) {
            return false;
        }
        const result = await this.collection.deleteOne(filter);
        return result.deletedCount > 0;
    }
}