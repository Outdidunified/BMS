import Notification from '../data/Notification.model.js';
import logger from '../utils/logger.js';

function validateEmails(emails) {
    if (!Array.isArray(emails)) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.every(e => typeof e === 'string' && emailRegex.test(e));
}

export async function upsertMapping(req, res) {
    try {
        const { deviceDI, emails } = req.body;
        if (!deviceDI || !validateEmails(emails)) return res.fail('deviceDI and valid emails[] required', 400);
        const doc = await Notification.findOneAndUpdate(
            { deviceDI },
            { deviceDI, emails },
            { upsert: true, new: true }
        );
        logger.loggerSuccess(`Notification mapping upserted DI=${deviceDI} emails=${emails.length}`);
        return res.ok(doc, 'Mapping upserted', 201);
    } catch (err) {
        logger.loggerError(`upsertMapping error: ${err.message || err}`);
        return res.fail(err.message || 'upsertMapping error', 400);
    }
}

export async function listMappings(_req, res) {
    try {
        const docs = await Notification.find();
        logger.loggerInfo(`Notification mappings listed count=${docs.length}`);
        return res.ok(docs, 'Mappings');
    } catch (err) {
        logger.loggerError(`listMappings error: ${err.message || err}`);
        return res.fail('failed to list mappings', 500);
    }
}

export async function getMapping(req, res) {
    try {
        const doc = await Notification.findOne({ deviceDI: req.params.di });
        if (!doc) return res.fail('Notification mapping not found', 404);
        return res.ok(doc, 'Notification mapping');
    } catch (err) {
        logger.loggerError(`getMapping error: ${err.message || err}`);
        return res.fail('failed to fetch mapping', 500);
    }
}

export async function updateMapping(req, res) {
    try {
        const { emails } = req.body;
        if (emails && !validateEmails(emails)) return res.fail('invalid emails[]', 400);
        const doc = await Notification.findOneAndUpdate(
            { deviceDI: req.params.di },
            { emails },
            { new: true }
        );
        if (!doc) {
            logger.loggerWarn(`updateMapping not found DI=${req.params.di}`);
            return res.fail('Mapping not found', 404);
        }
        logger.loggerSuccess(`Notification mapping updated DI=${req.params.di}`);
        return res.ok(doc, 'Mapping updated');
    } catch (err) {
        logger.loggerError(`updateMapping error: ${err.message || err}`);
        return res.fail(err.message || 'updateMapping error', 400);
    }
}

export async function deleteMapping(req, res) {
    try {
        const result = await Notification.deleteOne({ deviceDI: req.params.di });
        if (result.deletedCount === 0) {
            logger.loggerWarn(`deleteMapping not found DI=${req.params.di}`);
            return res.fail('Mapping not found', 404);
        }
        logger.loggerSuccess(`Notification mapping deleted DI=${req.params.di}`);
        return res.ok({ deleted: true }, 'Mapping deleted');
    } catch (err) {
        logger.loggerError(`deleteMapping error: ${err.message || err}`);
        return res.fail(err.message || 'deleteMapping error', 400);
    }
}

export async function deleteSpecificEmail(req, res) {
    try {
        const { di, email } = req.params;
        const doc = await Notification.findOne({ deviceDI: di });
        if (!doc) {
            logger.loggerWarn(`deleteSpecificEmail mapping not found DI=${di}`);
            return res.fail('Mapping not found', 404);
        }
        const newEmails = doc.emails.filter(e => e !== email);
        await Notification.updateOne({ deviceDI: di }, { emails: newEmails });
        logger.loggerSuccess(`Email ${email} removed from mapping DI=${di}`);
        return res.ok({ deviceDI: di, emails: newEmails }, 'Email removed from mapping');
    } catch (err) {
        logger.loggerError(`deleteSpecificEmail error: ${err.message || err}`);
        return res.fail(err.message || 'deleteSpecificEmail error', 400);
    }
}