import {
    deactivateNotificationReasonRecipient,
    getNotificationReasonRecipients,
    insertNotificationReasonRecipient,
    updateNotificationReasonRecipient,
} from '../../models/notifications/notification.reason.recipients.model.js';

const normalizeNullableString = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    return String(value).trim() || null;

};

const normalizeNullablePositiveInteger = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number(value);

    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : NaN;

};

const normalizeRequiredPositiveInteger = (value) => (
    normalizeNullablePositiveInteger(value) || NaN
);

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

const badRequest = (res, message) => res.status(400).json({
    success: false,
    message,
});

export const getNotificationReasonRecipientsConfig = async (req, res, next) => {

    try {
        const customerGroupId = normalizeNullablePositiveInteger(
            req.query?.customer_group_id ?? req.query?.customerGroupId
        );
        const isActive = normalizeNullableBooleanNumber(req.query?.is_active ?? req.query?.isActive);

        if (Number.isNaN(customerGroupId)) {
            return badRequest(res, 'customer_group_id invalido');
        }

        if (Number.isNaN(isActive)) {
            return badRequest(res, 'is_active invalido');
        }

        const data = await getNotificationReasonRecipients({
            customer_group_id: customerGroupId,
            notification_reason_code: normalizeNullableString(
                req.query?.notification_reason_code
                ?? req.query?.notificationReasonCode
                ?? req.query?.reason_code
                ?? req.query?.reasonCode
            )?.toUpperCase(),
            notification_channel_code: normalizeNullableString(
                req.query?.notification_channel_code
                ?? req.query?.notificationChannelCode
                ?? req.query?.channel_code
                ?? req.query?.channelCode
            )?.toUpperCase(),
            is_active: isActive,
        });

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        return next(error);
    }

};

const normalizeReasonRecipientPayload = (body = {}, { requireIsActive = false } = {}) => {

    const customerGroupId = normalizeRequiredPositiveInteger(
        body.customer_group_id ?? body.customerGroupId
    );
    const notificationReasonId = normalizeRequiredPositiveInteger(
        body.notification_reason_id ?? body.notificationReasonId
    );
    const notificationRecipientId = normalizeRequiredPositiveInteger(
        body.notification_recipient_id ?? body.notificationRecipientId
    );
    const notificationChannelId = normalizeRequiredPositiveInteger(
        body.notification_channel_id ?? body.notificationChannelId
    );
    const isActive = normalizeNullableBooleanNumber(body.is_active ?? body.isActive);

    if (Number.isNaN(customerGroupId)) {
        throw new Error('customer_group_id es requerido');
    }

    if (Number.isNaN(notificationReasonId)) {
        throw new Error('notification_reason_id es requerido');
    }

    if (Number.isNaN(notificationRecipientId)) {
        throw new Error('notification_recipient_id es requerido');
    }

    if (Number.isNaN(notificationChannelId)) {
        throw new Error('notification_channel_id es requerido');
    }

    if (Number.isNaN(isActive) || (requireIsActive && isActive === null)) {
        throw new Error('is_active invalido');
    }

    return {
        customer_group_id: customerGroupId,
        notification_reason_id: notificationReasonId,
        notification_recipient_id: notificationRecipientId,
        notification_channel_id: notificationChannelId,
        is_active: isActive,
    };

};

export const createNotificationReasonRecipientConfig = async (req, res, next) => {

    try {
        const payload = normalizeReasonRecipientPayload(req.body || {});
        const data = await insertNotificationReasonRecipient({
            ...payload,
            is_active: payload.is_active ?? 1,
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

export const updateNotificationReasonRecipientConfig = async (req, res, next) => {

    try {
        const id = normalizeRequiredPositiveInteger(req.params?.id);
        const payload = normalizeReasonRecipientPayload(req.body || {});

        if (Number.isNaN(id)) {
            return badRequest(res, 'id invalido');
        }

        const data = await updateNotificationReasonRecipient({
            id,
            ...payload,
        });

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Configuracion no encontrada',
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

export const deactivateNotificationReasonRecipientConfig = async (req, res, next) => {

    try {
        const id = normalizeRequiredPositiveInteger(req.params?.id);

        if (Number.isNaN(id)) {
            return badRequest(res, 'id invalido');
        }

        const data = await deactivateNotificationReasonRecipient(id);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Configuracion no encontrada',
            });
        }

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        return next(error);
    }

};
