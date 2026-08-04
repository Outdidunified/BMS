import logger from '../utils/logger.js';
import Telemetry from '../data/Telemetry.model.js';

class TelemetryBatcher {
    constructor(batchSize = 100, flushIntervalMs = 1000) {
        this.buffer = [];
        this.batchSize = batchSize;
        this.flushIntervalMs = flushIntervalMs;
        this.timer = null;
    }

    /**
     * Add a document to the batch buffer
     * @param {Object} doc Telemetry document
     */
    add(doc) {
        this.buffer.push(doc);
        
        // Flush if batch size reached
        if (this.buffer.length >= this.batchSize) {
            this.flush();
        } 
        // Otherwise set a timer to flush eventually if not already set
        else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
        }
    }

    /**
     * Flush the buffer to MongoDB
     */
    async flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.buffer.length === 0) return;

        const batch = [...this.buffer];
        this.buffer = [];

        try {
            // Using unordered insert for better performance and resilience against individual document errors
            await Telemetry.collection.insertMany(batch, { ordered: false });
            logger.loggerDebug(`Telemetry Batcher: Successfully flushed ${batch.length} documents`);
        } catch (err) {
            logger.loggerError(`Telemetry Batcher: Batch insert failed: ${err.message || err}`);
            // In case of error, we don't retry to avoid infinite loops or memory leaks, 
            // as telemetry is high-frequency and some loss is acceptable over blocking the system.
        }
    }
}

export default new TelemetryBatcher();
