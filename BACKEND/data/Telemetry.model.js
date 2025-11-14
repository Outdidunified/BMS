import { collections } from '../config/db.js';

// Provide a shape compatible with existing controllers: Telemetry.collection
const Telemetry = {
    get collection() {
        return collections().telemetry; // native MongoDB Collection
    },
};

export default Telemetry;