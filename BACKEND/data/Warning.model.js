import { ObjectId } from 'mongodb';

const WarningSchema = {
    _id: ObjectId,
    deviceId: String,
    thresholds: {
        voltage_high: Number,
        voltage_low: Number,
        temp_high: Number,
        temp_low: Number,
        current_high: Number,
        current_low: Number,
    },
    createdAt: Date,
    updatedAt: Date,
};

export default class Warning {
    constructor(db) {
        this.collection = db.collection('warnings');
    }

    async create(warningData) {
        const warning = {
            ...warningData,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.collection.insertOne(warning);
        return { _id: result.insertedId, ...warning };
    }

    async findByDeviceId(deviceId) {
        return await this.collection.findOne({ deviceId });
    }

    async findAll() {
        return await this.collection.find({}).toArray();
    }

    async update(id, updateData) {
        const result = await this.collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updateData, updatedAt: new Date() } }
        );
        return result.modifiedCount > 0;
    }

    async upsertByDeviceId(deviceId, thresholds) {
        const result = await this.collection.updateOne(
            { deviceId },
            { $set: { thresholds, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
        );
        return result.upsertedId || result.modifiedCount > 0;
    }

    async delete(id) {
        const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount > 0;
    }
}