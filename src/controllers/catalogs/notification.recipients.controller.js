import { getNotificationRecipients } from '../../models/catalogs/notification.recipients.model.js';

const normalizeNullableNumber = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number(value);

    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : NaN;

};

const normalizeNullableBooleanNumber = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const normalizedValue = String(value).trim().toLowerCase();

    if (['1', 'true', 'yes', 'y'].includes(normalizedValue)) {
        return 1;
    }

    if (['0', 'false', 'no', 'n'].includes(normalizedValue)) {
        return 0;
    }

    return NaN;

};

const normalizeNullableString = (value) => {

    if (value === undefined || value === null) {
        return null;
    }

    const normalizedValue = String(value).trim();

    return normalizedValue || null;

};

export const getCatNotificationRecipients = async (req, res, next) => {

    try {
        const id = normalizeNullableNumber(req.query?.id);
        const notificationChannelId = normalizeNullableNumber(
            req.query?.notification_channel_id ?? req.query?.notificationChannelId
        );
        const customerCode = normalizeNullableString(req.query?.customer_code ?? req.query?.customerCode);
        const isActive = normalizeNullableBooleanNumber(req.query?.is_active ?? req.query?.isActive);

        if (Number.isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'id invalido',
            });
        }

        if (Number.isNaN(notificationChannelId)) {
            return res.status(400).json({
                success: false,
                message: 'notification_channel_id invalido',
            });
        }

        if (Number.isNaN(isActive)) {
            return res.status(400).json({
                success: false,
                message: 'is_active invalido',
            });
        }

        const recipients = await getNotificationRecipients({
            id,
            notificationChannelId,
            customerCode,
            isActive,
        });

        return res.json({
            success: true,
            data: recipients,
        });
    } catch (error) {
        return next(error);
    }

};
