import { collections } from '../config/db.js';

// Minimal wrapper to mimic common Mongoose calls used in controllers
const col = () => collections().devices;

const Device = {
    get collection() {
        return col();
    },
    async create(doc) {
        const { insertedId } = await col().insertOne(doc);
        return { ...doc, _id: insertedId };
    },
    async find(filter = {}) {
        return await col().find(filter).toArray();
    },
    async findOne(filter) {
        return await col().findOne(filter);
    },
    async findOneAndUpdate(filter, update, options = {}) {
        const opts = {
            upsert: !!options.upsert,
            includeResultMetadata: !!options.rawResult,
        };
        // Support both MongoDB driver v3 (returnOriginal) and v4+ (returnDocument)
        if (Object.prototype.hasOwnProperty.call(options, 'new')) {
            opts.returnDocument = options.new ? 'after' : 'before';
            opts.returnOriginal = !options.new;
        }
        // Allow passing operators like $set/$unset; if none provided, wrap in $set
        const hasOperator = update && Object.keys(update).some(k => k.startsWith('$'));
        const updateDoc = hasOperator ? update : { $set: update };
        const result = await col().findOneAndUpdate(
            filter,
            updateDoc,
            opts
        );
        if (!options.rawResult) {
            return result;
        }
        return result;
    },
    async deleteOne(filter) {
        return await col().deleteOne(filter);
    },
};

export default Device;