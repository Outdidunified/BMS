import { ObjectId } from 'mongodb';

export default class Role {
    constructor(db) {
        this.collection = db.collection('roles');
        this.countersCollection = db.collection('counters');
    }

    async getNextRoleId() {
        const result = await this.countersCollection.findOneAndUpdate(
            { _id: 'role_id' },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        return result.seq;
    }

    async create(roleData) {
        let role_id;
        if (roleData.role_id) {
            role_id = roleData.role_id;
        } else {
            role_id = await this.getNextRoleId();
        }
        const role = {
            role_id,
            name: roleData.name,
            permissions: roleData.permissions || [],
            status: roleData.status !== undefined ? roleData.status : true,
            createdAt: new Date()
        };

        const result = await this.collection.insertOne(role);
        return { _id: result.insertedId, ...role };
    }

    async findAll() {
        return await this.collection.find({}).toArray();
    }

    async findById(id) {
        return await this.collection.findOne({ _id: new ObjectId(id) });
    }

    async findByRoleId(role_id) {
        return await this.collection.findOne({ role_id: Number(role_id) });
    }

    async findByName(name) {
        return await this.collection.findOne({ name });
    }

    async update(id, updateData) {
        const result = await this.collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updateData, updatedAt: new Date() } }
        );
        return result.modifiedCount > 0;
    }

    async delete(id) {
        // Get the role to find its role_id
        const role = await this.collection.findOne({ _id: new ObjectId(id) });
        if (!role) {
            return false;
        }

        // Check if any users have this role
        const usersWithRole = await this.collection.db.collection('users').countDocuments({ role_id: role.role_id });
        if (usersWithRole > 0) {
            throw new Error('Cannot delete role: users are assigned to this role');
        }

        const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount > 0;
    }

    async findActive() {
        return await this.collection.find({ status: true }).toArray();
    }
}