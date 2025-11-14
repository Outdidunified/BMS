import nodemailer from 'nodemailer';
import Notification from '../data/Notification.model.js';
import logger from './logger.js';

function getTransport() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
    if (!SMTP_HOST || !SMTP_PORT) return null;
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === 'true',
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
}

function detectAbnormal(device, doc) {
    const params = doc.params || {};
    const tele = doc.telemetry || {};
    const { alerts = {} } = device || {};
    const issues = [];

    const ovp = alerts.ovp; // per-cell voltage max
    const ocp = alerts.ocp; // current max (absolute)
    const otp = alerts.otp; // temperature max

    // Helper getters prefer full-form then fallback to legacy
    const getVoltage = (i) => {
        const vFull = Array.isArray(tele.voltages) ? tele.voltages[i - 1] : undefined;
        return typeof vFull === 'number' ? vFull : params[`v${i}`];
    };
    const getTemp = (i) => {
        const tFull = Array.isArray(tele.temperatures) ? tele.temperatures[i - 1] : undefined;
        return typeof tFull === 'number' ? tFull : params[`T${i}`];
    };
    const packVoltage = typeof tele.packVoltage === 'number' ? tele.packVoltage : params.pv;
    const currents = {
        charging: typeof tele?.currents?.charging === 'number' ? tele.currents.charging : params.cc,
        discharging: typeof tele?.currents?.discharging === 'number' ? tele.currents.discharging : params.dc,
        load: typeof tele?.currents?.load === 'number' ? tele.currents.load : params.lc,
    };

    if (ovp) {
        for (let i = 1; i <= 24; i++) {
            const v = getVoltage(i);
            if (typeof v === 'number' && v > ovp) issues.push(`Over-voltage v${i}=${v}V > ${ovp}V`);
        }
        if (typeof packVoltage === 'number' && packVoltage > ovp * 24) issues.push(`Pack voltage pv=${packVoltage}V > ${ovp * 24}V`);
    }

    if (ocp) {
        [
            ['cc', currents.charging],
            ['dc', currents.discharging],
            ['lc', currents.load],
        ].forEach(([k, val]) => {
            if (typeof val === 'number' && Math.abs(val) > ocp) issues.push(`Over-current ${k}=${val}A > ${ocp}A`);
        });
    }

    if (otp) {
        for (let i = 1; i <= 25; i++) {
            const t = getTemp(i);
            if (typeof t === 'number' && t > otp) issues.push(`Over-temp T${i}=${t}°C > ${otp}°C`);
        }
    }

    return issues;
}

export async function evaluateAndSendAlerts(device, doc) {
    try {
        if (!device) return;
        const issues = detectAbnormal(device, doc);
        if (issues.length === 0) return; // nothing to alert

        const mapping = await Notification.findOne({ deviceDI: device.DI }).lean();
        const recipients = mapping?.emails || [];
        if (recipients.length === 0) return;

        const transporter = getTransport();
        if (!transporter) return; // SMTP not configured

        const subject = `[BMS Alert] ${device.DI} issues detected`;
        const text = `Device ${device.DI} at ${doc.timestamp?.toISOString()}:\n` + issues.join('\n');
        await transporter.sendMail({ from: 'bms@system.local', to: recipients.join(','), subject, text });
        logger.loggerInfo(`Alert email sent DI=${device.DI} recipients=${recipients.length}`);
    } catch (e) {
        logger.loggerError(`evaluateAndSendAlerts error: ${e?.message || e}`);
    }
}