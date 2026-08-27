import { getNotificationDispatchLogs } from '../../models/notifications/notification.dispatch.logs.model.js';

const normalizeNullablePositiveInteger = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number(value);

    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : NaN;

};

const badRequest = (res, message) => res.status(400).json({
    success: false,
    message,
});

export const getNotificationDispatchLogsConfig = async (req, res, next) => {

    try {
        const id = normalizeNullablePositiveInteger(req.query?.id);
        const notificationReasonId = normalizeNullablePositiveInteger(
            req.query?.notification_reason_id
            ?? req.query?.notificationReasonId
            ?? req.query?.reason_id
            ?? req.query?.reasonId
        );
        const notificationChannelId = normalizeNullablePositiveInteger(
            req.query?.notification_channel_id
            ?? req.query?.notificationChannelId
            ?? req.query?.channel_id
            ?? req.query?.channelId
        );
        const customerGroupId = normalizeNullablePositiveInteger(
            req.query?.customer_group_id
            ?? req.query?.customerGroupId
            ?? req.query?.group_id
            ?? req.query?.groupId
        );

        if (Number.isNaN(id)) {
            return badRequest(res, 'id invalido');
        }

        if (Number.isNaN(notificationReasonId)) {
            return badRequest(res, 'notification_reason_id invalido');
        }

        if (Number.isNaN(notificationChannelId)) {
            return badRequest(res, 'notification_channel_id invalido');
        }

        if (Number.isNaN(customerGroupId)) {
            return badRequest(res, 'customer_group_id invalido');
        }

        const data = await getNotificationDispatchLogs({
            id,
            notification_reason_id: notificationReasonId,
            notification_channel_id: notificationChannelId,
            customer_group_id: customerGroupId,
        });

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        return next(error);
    }

};
