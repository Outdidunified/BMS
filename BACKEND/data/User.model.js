import { ObjectId } from 'mongodb';

const UserSchema = {
    _id: ObjectId,
    username: String,
    email: String,
    password: String, // plain text
    role_id: Number, // reference to role.role_id
    createdAt: Date,
    updatedAt: Date,
};

export default class User {
    constructor(db) {
        this.collection = db.collection('users');
    }

    async create(userData) {
        const user = {
            ...userData,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.collection.insertOne(user);
        return { _id: result.insertedId, ...user };
    }

    async findByUsername(username) {
        return await this.collection.findOne({ username });
    }

    async findByEmail(email) {
        return await this.collection.findOne({ email });
    }

    async findById(id) {
        return await this.collection.findOne({ _id: new ObjectId(id) });
    }

    async update(id, updateData) {
        const result = await this.collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updateData, updatedAt: new Date() } }
        );
        return result.modifiedCount > 0;
    }

    async findAll() {
        return await this.collection.find({}).toArray();
    }

    async delete(id) {
        const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount > 0;
    }
}