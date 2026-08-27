import {
    getNotificationRecipients,
    insertNotificationRecipient,
    updateNotificationRecipient,
} from '../../models/catalogs/notification.recipients.model.js';

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

const normalizeRequiredString = (value) => normalizeNullableString(value);

const normalizeRequiredNumber = (value) => (
    normalizeNullableNumber(value) || NaN
);

const badRequest = (res, message) => res.status(400).json({
    success: false,
    message,
});

export const getCatNotificationRecipients = async (req, res, next) => {

    try {
        const id = normalizeNullableNumber(req.query?.id);
        const notificationChannelId = normalizeNullableNumber(
            req.query?.notification_channel_id ?? req.query?.notificationChannelId
        );
        const customerCode = normalizeNullableString(req.query?.customer_code ?? req.query?.customerCode);
        const isActive = normalizeNullableBooleanNumber(req.query?.is_active ?? req.query?.isActive);

        if (Number.isNaN(id)) {
            return badRequest(res, 'id invalido');
        }

        if (Number.isNaN(notificationChannelId)) {
            return badRequest(res, 'notification_channel_id invalido');
        }

        if (Number.isNaN(isActive)) {
            return badRequest(res, 'is_active invalido');
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

const normalizeNotificationRecipientPayload = (body = {}) => {

    const notificationChannelId = normalizeRequiredNumber(
        body.notification_channel_id ?? body.notificationChannelId
    );
    const recipientValue = normalizeRequiredString(body.recipient_value ?? body.recipientValue);
    const isActive = normalizeNullableBooleanNumber(body.is_active ?? body.isActive);

    if (Number.isNaN(notificationChannelId)) {
        throw new Error('notification_channel_id es requerido');
    }

    if (!recipientValue) {
        throw new Error('recipient_value es requerido');
    }

    if (Number.isNaN(isActive)) {
        throw new Error('is_active invalido');
    }

    return {
        customerCode: normalizeNullableString(body.customer_code ?? body.customerCode),
        notificationChannelId,
        recipientValue,
        isActive,
    };

};

export const createCatNotificationRecipient = async (req, res, next) => {

    try {
        const payload = normalizeNotificationRecipientPayload(req.body || {});
        const data = await insertNotificationRecipient({
            ...payload,
            isActive: payload.isActive ?? 1,
        });

        return res.status(201).json({
            success: true,
            data,
        });
    } catch (error) {
        if (error.message?.includes('requerido') || error.message?.includes('invalido')) {
            return badRequest(res, error.message);
        }

        return next(error);
    }

};

export const updateCatNotificationRecipient = async (req, res, next) => {

    try {
        const id = normalizeRequiredNumber(req.params?.id);
        const payload = normalizeNotificationRecipientPayload(req.body || {});

        if (Number.isNaN(id)) {
            return badRequest(res, 'id invalido');
        }

        const data = await updateNotificationRecipient({
            id,
            ...payload,
        });

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Destinatario no encontrado',
            });
        }

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        if (error.message?.includes('requerido') || error.message?.includes('invalido')) {
            return badRequest(res, error.message);
        }

        return next(error);
    }

};
