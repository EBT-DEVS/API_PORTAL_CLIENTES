import { getCrossCustomsNotificationContext } from '../../models/crosses/crosses.customs.model.js';
import {
    getRecentCustomsLightDispatchLog,
    insertNotificationDispatchLog,
} from '../../models/notifications/notification.dispatch.logs.model.js';
import { getNotificationReasonRecipients } from '../../models/notifications/notification.reason.recipients.model.js';
import { sendEmail } from './notificationChannelDispatcher.service.js';

const NOTIFICATION_REASON_CODE = 'CUSTOMS_RED_LIGHT';
const NOTIFICATION_CHANNEL_CODE = 'EMAIL';
const NOTIFIABLE_LIGHTS = new Set(['YELLOW', 'RED']);
const DISPLAY_TIME_ZONE = 'America/Chicago';
const RESEND_WINDOW_MINUTES = 10;

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const uniqueValues = (values = []) => [...new Set(values.filter(Boolean))];

const getRecipientEmails = (recipients = []) => uniqueValues(
    recipients.map((recipient) => recipient?.recipient_value)
);

const getCustomsCountryLabel = (customsCountry) => (
    customsCountry === 'US' ? 'USA' : customsCountry
);

const getLightIcon = (light) => ({
    RED: '🔴',
    YELLOW: '🟡',
}[light] || '');

const formatDisplayDate = (date) => {

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: DISPLAY_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value])
    );

    return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;

};

const buildSubject = ({ trailerId, customsCountry, light }) => (
    `${getLightIcon(light)} Alerta de Aduana ${getCustomsCountryLabel(customsCountry)} - Caja #${trailerId || '0000'}`
);

const normalizeComment = (value) => {

    const normalizedValue = String(value ?? '').trim();

    return normalizedValue || null;

};

const buildCommentRow = (comments) => (
    comments
        ? `
                <tr>
                    <td style="background-color: #f4f7fb; padding: 10px 12px; font-weight: bold;">Comentario</td>
                    <td style="padding: 10px 12px;">${escapeHtml(comments)}</td>
                </tr>
        `
        : ''
);

const buildHtml = ({
    context,
    customsCountry,
    light,
    sentAt,
    comments,
}) => `
    <div style="font-family: Arial, sans-serif; color: #1f2933; padding: 16px;">
        <h2 style="margin: 0 0 16px; color: #1f2933;">Alerta de luz en aduana</h2>
        <table cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; max-width: 620px; font-size: 14px; border: 1px solid #d9e2ec;">
            <tbody>
                <tr>
                    <td style="background-color: #f4f7fb; border-bottom: 1px solid #d9e2ec; padding: 10px 12px; font-weight: bold; width: 160px;">Caja</td>
                    <td style="border-bottom: 1px solid #d9e2ec; padding: 10px 12px;">${escapeHtml(context?.trailer_id || 'Sin caja')}</td>
                </tr>
                <tr>
                    <td style="background-color: #f4f7fb; border-bottom: 1px solid #d9e2ec; padding: 10px 12px; font-weight: bold;">Aduana</td>
                    <td style="border-bottom: 1px solid #d9e2ec; padding: 10px 12px;">${escapeHtml(getCustomsCountryLabel(customsCountry))} - ${escapeHtml(context?.stop_name || context?.stop_code || 'Sin aduana')}</td>
                </tr>
                <tr>
                    <td style="background-color: #f4f7fb; border-bottom: 1px solid #d9e2ec; padding: 10px 12px; font-weight: bold;">Luz</td>
                    <td style="border-bottom: 1px solid #d9e2ec; padding: 10px 12px;">${getLightIcon(light)} ${escapeHtml(light)}</td>
                </tr>
                <tr>
                    <td style="background-color: #f4f7fb; ${comments ? 'border-bottom: 1px solid #d9e2ec;' : ''} padding: 10px 12px; font-weight: bold;">Fecha</td>
                    <td style="${comments ? 'border-bottom: 1px solid #d9e2ec;' : ''} padding: 10px 12px;">${escapeHtml(formatDisplayDate(sentAt))}</td>
                </tr>
                ${buildCommentRow(comments)}
            </tbody>
        </table>
    </div>
`;

const buildRecipientsJson = (emails) => JSON.stringify(emails);

const minutesSince = (value, now = new Date()) => {

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return (now.getTime() - date.getTime()) / 60000;

};

const shouldSkipRecentNotification = (recentLog, now) => {

    const elapsedMinutes = minutesSince(recentLog?.sent_at, now);

    return elapsedMinutes !== null && elapsedMinutes <= RESEND_WINDOW_MINUTES;

};

export const notifyCustomsLightIfNeeded = async ({
    cross_stop_id,
    customs_country,
    light,
    comments = null,
} = {}) => {

    if (!NOTIFIABLE_LIGHTS.has(light)) {
        return {
            status: 'NOT_REQUIRED',
        };
    }

    const sentAt = new Date();
    const context = await getCrossCustomsNotificationContext(cross_stop_id);

    if (!context?.customer_group_id) {
        return {
            status: 'SKIPPED',
            reason: 'missing_customer_group',
        };
    }

    const recentLog = await getRecentCustomsLightDispatchLog({
        trailer_id: context.trailer_id,
        customs_country,
        light,
    });

    if (shouldSkipRecentNotification(recentLog, sentAt)) {
        return {
            status: 'SKIPPED',
            reason: 'recent_notification_sent',
            previous_log: recentLog,
            resend_window_minutes: RESEND_WINDOW_MINUTES,
        };
    }

    const recipients = await getNotificationReasonRecipients({
        customer_group_id: context.customer_group_id,
        notification_reason_code: NOTIFICATION_REASON_CODE,
        notification_channel_code: NOTIFICATION_CHANNEL_CODE,
        is_active: 1,
    });
    const emails = getRecipientEmails(recipients);

    if (!emails.length) {
        return {
            status: 'SKIPPED',
            reason: 'missing_recipients',
            customer_group_id: context.customer_group_id,
        };
    }

    const notificationReasonId = recipients[0]?.notification_reason_id || null;
    const notificationChannelId = recipients[0]?.notification_channel_id || null;
    const commentsValue = normalizeComment(comments) || normalizeComment(context.comments);
    const subject = buildSubject({
        trailerId: context.trailer_id,
        customsCountry: customs_country,
        light,
    });
    const logBasePayload = {
        notification_reason_id: notificationReasonId,
        notification_channel_id: notificationChannelId,
        customer_group_id: context.customer_group_id,
        entity_id: cross_stop_id,
        subject,
        recipients_json: buildRecipientsJson(emails),
        sent_at: sentAt,
    };

    let emailResponse = null;

    try {
        emailResponse = await sendEmail({
            destinatarios: emails,
            asunto: subject,
            html: buildHtml({
                context,
                customsCountry: customs_country,
                light,
                sentAt,
                comments: commentsValue,
            }),
        });
    } catch (error) {
        const log = await insertNotificationDispatchLog({
            ...logBasePayload,
            status: 'FAILED',
        });

        return {
            status: 'FAILED',
            reason: error.message,
            recipients: emails,
            log,
        };
    }

    const log = await insertNotificationDispatchLog({
        ...logBasePayload,
        status: 'SENT',
    });

    return {
        status: 'SENT',
        recipients: emails,
        response: emailResponse,
        log,
    };

};
