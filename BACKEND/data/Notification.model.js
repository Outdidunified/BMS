import { collections } from '../config/db.js';

const col = () => collections().notifications;

const Notification = {
    async find() {
        return await col().find({}).toArray();
    },
    async findOne(filter) {
        return await col().findOne(filter);
    },
    async findOneAndUpdate(filter, update, options = {}) {
        const opts = { upsert: !!options.upsert };
        // Support both MongoDB driver v3 (returnOriginal) and v4+ (returnDocument)
        if (Object.prototype.hasOwnProperty.call(options, 'new')) {
            opts.returnDocument = options.new ? 'after' : 'before';
            opts.returnOriginal = !options.new;
        }
        const result = await col().findOneAndUpdate(
            filter,
            { $set: update },
            opts
        );
        // Driver v4+ returns the document (or null). v3 returns an object with { value, lastErrorObject }
        if (!result) return null;
        if (Object.prototype.hasOwnProperty.call(result, 'value')) {
            const { value, lastErrorObject } = result;
            if (!value && lastErrorObject?.upserted) {
                return await col().findOne({ _id: lastErrorObject.upserted });
            }
            return value;
        }
        return result; // v4+: already the document
    },
    async deleteOne(filter) {
        return await col().deleteOne(filter);
    },
    async updateOne(filter, update) {
        return await col().updateOne(filter, { $set: update });
    },
};

export default Notification;