import { collections } from '../config/db.js';

const TelemetryCycle = {
    get collection() {
        return collections().telemetryCycles;
    },
};

export default TelemetryCycle;