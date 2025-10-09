import { ObjectId } from 'mongodb';

const StationSchema = {
    _id: ObjectId,
    station_id: Number,
    name: String,
    location: String, // optional
    status: Boolean,
    devices: [String], // device ids assigned to the station
    warnings: Object, // nested warning thresholds by category
    createdAt: Date,
    updatedAt: Date,
};

export default class Station {
    constructor(db) {
        this.collection = db.collection('stations');
        this.counters = db.collection('counters');
    }

    async getNextStationId() {
        const result = await this.counters.findOneAndUpdate(
            { _id: 'station_id' },
            { $inc: { seq: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
        return result.seq;
    }

    async create(stationData) {
        const station_id = await this.getNextStationId();
        const station = {
            station_id,
            status: true, // default to true
            devices: null, // default to no linked device
            warnings: {}, // default empty warnings object
            ...stationData,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.collection.insertOne(station);
        return { _id: result.insertedId, ...station };
    }

    async findById(id) {
        return await this.collection.findOne({ _id: new ObjectId(id) });
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

    async delete(id) {
        const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount > 0;
    }
}