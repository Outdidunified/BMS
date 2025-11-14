import { collections } from '../config/db.js';

const WarningHistory = {
    get collection() {
        return collections().warningHistory;
    },
};

export default WarningHistory;