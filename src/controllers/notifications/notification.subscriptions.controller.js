import {
    createNotificationSubscription,
    deactivateNotificationSubscriptionById,
    getNotificationSubscriptions,
} from '../../models/notifications/notification.subscriptions.model.js';

const normalizeNullableString = (value) => {

    if (value === undefined || value === null) {
        return null;
    }

    const normalizedValue = String(value).trim();

    return normalizedValue || null;

};

const normalizeRequiredString = (value) => normalizeNullableString(value);

const normalizeNullableDate = (value) => normalizeNullableString(value);

const normalizeNullablePositiveInteger = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number(value);

    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : NaN;

};

const normalizeRequiredPositiveInteger = (value) => {

    const parsedValue = normalizeNullablePositiveInteger(value);

    return parsedValue || NaN;

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

const normalizeRecipient = (recipient, index) => {

    if (typeof recipient === 'number' || typeof recipient === 'string') {
        const id = normalizeRequiredPositiveInteger(recipient);

        if (Number.isNaN(id)) {
            throw new Error(`recipients[${index}] invalido`);
        }

        return { id };
    }

    if (!recipient || typeof recipient !== 'object') {
        throw new Error(`recipients[${index}] invalido`);
    }

    const id = normalizeNullablePositiveInteger(recipient.id);

    if (Number.isNaN(id)) {
        throw new Error(`recipients[${index}].id invalido`);
    }

    if (id) {
        return { id };
    }

    const notificationChannelId = normalizeNullablePositiveInteger(
        recipient.notification_channel_id ?? recipient.notificationChannelId
    );
    const isActive = normalizeNullableBooleanNumber(recipient.is_active ?? recipient.isActive);
    const recipientValue = normalizeRequiredString(recipient.recipient_value ?? recipient.recipientValue);

    if (Number.isNaN(notificationChannelId)) {
        throw new Error(`recipients[${index}].notification_channel_id invalido`);
    }

    if (Number.isNaN(isActive)) {
        throw new Error(`recipients[${index}].is_active invalido`);
    }

    if (!recipientValue) {
        throw new Error(`recipients[${index}].recipient_value es requerido`);
    }

    return {
        customer_code: normalizeNullableString(recipient.customer_code ?? recipient.customerCode),
        notification_channel_id: notificationChannelId,
        recipient_value: recipientValue,
        is_active: isActive,
    };

};

const normalizeCrossing = (crossing, index) => {

    const rawValue = typeof crossing === 'object' && crossing !== null
        ? crossing.id ?? crossing.crossing_id ?? crossing.crossingId
        : crossing;
    const crossingId = normalizeRequiredPositiveInteger(rawValue);

    if (Number.isNaN(crossingId)) {
        throw new Error(`crossings[${index}] invalido`);
    }

    return crossingId;

};

const badRequest = (res, message) => res.status(400).json({
    success: false,
    message,
});

export const getNotificationSubscriptionsConfig = async (req, res, next) => {

    try {
        const id = normalizeNullablePositiveInteger(req.query?.id);
        const customerCode = normalizeNullableString(req.query?.customer_code ?? req.query?.customerCode);
        const channel = normalizeNullableString(
            req.query?.channel
            ?? req.query?.notification_channel
            ?? req.query?.notificationChannel
            ?? req.query?.notification_channel_id
            ?? req.query?.notificationChannelId
        );
        const frequency = normalizeNullableString(
            req.query?.frequency
            ?? req.query?.notification_frequency
            ?? req.query?.notificationFrequency
            ?? req.query?.notification_frequency_id
            ?? req.query?.notificationFrequencyId
        );
        const isActive = normalizeNullableBooleanNumber(req.query?.is_active ?? req.query?.isActive);

        if (Number.isNaN(id)) {
            return badRequest(res, 'id invalido');
        }

        if (Number.isNaN(isActive)) {
            return badRequest(res, 'is_active invalido');
        }

        const data = await getNotificationSubscriptions({
            id,
            customerCode,
            channel,
            frequency,
            isActive,
        });

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        return next(error);
    }

};

export const deactivateNotificationSubscriptionConfig = async (req, res, next) => {

    try {
        const id = normalizeRequiredPositiveInteger(req.params?.id);

        if (Number.isNaN(id)) {
            return badRequest(res, 'id invalido');
        }

        const data = await deactivateNotificationSubscriptionById(id);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Suscripcion no encontrada',
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

export const createNotificationSubscriptionFlow = async (req, res, next) => {

    try {
        const body = req.body || {};
        const customerCode = normalizeRequiredString(body.customer_code ?? body.customerCode);
        const customerName = normalizeRequiredString(body.customer_name ?? body.customerName);
        const notificationChannelId = normalizeRequiredPositiveInteger(
            body.notification_channel_id ?? body.notificationChannelId
        );
        const notificationFrequencyId = normalizeRequiredPositiveInteger(
            body.notification_frequency_id ?? body.notificationFrequencyId
        );
        const isActive = normalizeNullableBooleanNumber(body.is_active ?? body.isActive);
        const recipients = Array.isArray(body.recipients) ? body.recipients.map(normalizeRecipient) : [];
        const crossings = Array.isArray(body.crossings) ? body.crossings.map(normalizeCrossing) : [];

        if (!customerCode) {
            return badRequest(res, 'customer_code es requerido');
        }

        if (!customerName) {
            return badRequest(res, 'customer_name es requerido');
        }

        if (Number.isNaN(notificationChannelId)) {
            return badRequest(res, 'notification_channel_id invalido');
        }

        if (Number.isNaN(notificationFrequencyId)) {
            return badRequest(res, 'notification_frequency_id invalido');
        }

        if (Number.isNaN(isActive)) {
            return badRequest(res, 'is_active invalido');
        }

        const data = await createNotificationSubscription({
            customer_code: customerCode,
            customer_name: customerName,
            notification_channel_id: notificationChannelId,
            notification_frequency_id: notificationFrequencyId,
            last_notification_at: normalizeNullableDate(body.last_notification_at ?? body.lastNotificationAt),
            is_active: isActive,
            recipients,
            crossings,
        });

        return res.status(201).json({
            success: true,
            data,
        });
    } catch (error) {
        if (error.message?.includes('invalido') || error.message?.includes('requerido')) {
            return badRequest(res, error.message);
        }

        return next(error);
    }

};
