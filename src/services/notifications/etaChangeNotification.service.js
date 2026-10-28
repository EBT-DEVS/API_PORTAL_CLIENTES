import { insertNotificationDispatchLog } from '../../models/notifications/notification.dispatch.logs.model.js';
import { getNotificationReasonRecipients } from '../../models/notifications/notification.reason.recipients.model.js';
import { sendEmail } from './notificationChannelDispatcher.service.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// PC*Miler stores local SQL datetimes; mysql2 returns them as local Date objects.
const toEtaDate = (value) => {
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value : null;
    }

    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, year, month, day, hour, minute, second] = match.map(Number);
    const date = new Date(year, month - 1, day, hour, minute, second);
    return date.getFullYear() === year && date.getMonth() === month - 1
        && date.getDate() === day && date.getHours() === hour
        && date.getMinutes() === minute && date.getSeconds() === second ? date : null;
};

export const getEtaChange = (previousEta, newEta) => {
    const previous = toEtaDate(previousEta);
    const next = toEtaDate(newEta);
    if (!previous || !next) return null;
    const differenceMs = next.getTime() - previous.getTime();
    return differenceMs > ONE_HOUR_MS
        ? { previous, next, differenceMs }
        : null;
};

const formatEta = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const notifyEtaChangeIfNeeded = async ({
    previousEta,
    newEta,
    cross = {},
    stop = {},
} = {}, dependencies = {}) => {
    if ([1, 12, 13].includes(Number(cross.cross_status_id))) {
        return { status: 'NOT_REQUIRED', reason: 'excluded_status' };
    }

    const change = getEtaChange(previousEta, newEta);
    if (!change) return { status: 'NOT_REQUIRED' };

    const getRecipients = dependencies.getRecipients || getNotificationReasonRecipients;
    const dispatch = dependencies.sendEmail || sendEmail;
    const insertLog = dependencies.insertLog || insertNotificationDispatchLog;

    try {
        if (!cross.customer_group_id) {
            return { status: 'SKIPPED', reason: 'missing_customer_group' };
        }
        const recipients = await getRecipients({
            customer_group_id: cross.customer_group_id,
            notification_reason_code: process.env.ETA_CHANGE_NOTIFICATION_REASON_CODE || 'CHANGED_ETA',
            notification_channel_code: 'EMAIL',
            is_active: 1,
        });
        const emails = [...new Set(recipients.map((recipient) => recipient.recipient_value).filter(Boolean))];
        if (!emails.length) return { status: 'SKIPPED', reason: 'missing_recipients' };

        const subject = `Cambio de ETA - Caja ${cross.trailer_id || 'sin caja'} - Orden ${cross.mcleod_order_id || 'sin orden'}`;
        const rows = [
            ['Caja', cross.trailer_id],
            ['Orden', cross.mcleod_order_id],
            ['PO', cross.po_number],
            ['Sig. Parada', stop.stop_name || stop.stop_code],
            ['ETA anterior', formatEta(change.previous)],
            ['ETA nuevo', formatEta(change.next)],
            ['Diferencia', `${(change.differenceMs / 60000).toFixed(2)} minutos (retraso)`],
        ];
        const html = `<div style="font-family: Arial, sans-serif; color: #1f2933; padding: 16px;">
            <h2>Retraso de ETA mayor a una hora</h2>
            <table cellspacing="0" cellpadding="8" style="border-collapse: collapse;">
                ${rows.map(([label, value]) => `<tr><th style="text-align: left; border: 1px solid #d9e2ec;">${escapeHtml(label)}</th><td style="border: 1px solid #d9e2ec;">${escapeHtml(value)}</td></tr>`).join('')}
            </table></div>`;
        const logPayload = {
            notification_reason_id: recipients[0].notification_reason_id,
            notification_channel_id: recipients[0].notification_channel_id,
            customer_group_id: cross.customer_group_id,
            entity_id: stop.id || stop.cross_stop_id,
            subject,
            recipients_json: JSON.stringify(emails),
            sent_at: new Date(),
        };
        try {
            await dispatch({ destinatarios: emails, asunto: subject, html });
        } catch (error) {
            await insertLog({ ...logPayload, status: 'FAILED' });
            return { status: 'FAILED', reason: error.message };
        }
        await insertLog({ ...logPayload, status: 'SENT' });
        return { status: 'SENT' };
    } catch (error) {
        // A notification failure must not interrupt stop synchronization.
        return { status: 'ERROR', reason: error.message };
    }
};
