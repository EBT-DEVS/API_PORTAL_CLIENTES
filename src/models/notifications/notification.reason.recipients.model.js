import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstResultSet = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet)) || []
);

const getFirstRow = (resultSets = []) => (
    getFirstResultSet(resultSets)[0] || null
);

export const getNotificationReasonRecipients = async ({
    customer_group_id = null,
    notification_reason_code = null,
    notification_channel_code = null,
    is_active = null,
} = {}) => {

    const resultSets = await executeSp('sp_notification_reason_recipients_get', [
        customer_group_id,
        notification_reason_code,
        notification_channel_code,
        is_active,
    ]);

    return getFirstResultSet(resultSets);

};

export const insertNotificationReasonRecipient = async ({
    customer_group_id,
    notification_reason_id,
    notification_recipient_id,
    notification_channel_id,
    is_active = 1,
} = {}) => {

    const resultSets = await executeSp('sp_notification_reason_recipient_insert', [
        customer_group_id,
        notification_reason_id,
        notification_recipient_id,
        notification_channel_id,
        is_active,
    ]);

    return getFirstRow(resultSets);

};

export const updateNotificationReasonRecipient = async ({
    id,
    customer_group_id,
    notification_reason_id,
    notification_recipient_id,
    notification_channel_id,
    is_active = null,
} = {}) => {

    const resultSets = await executeSp('sp_notification_reason_recipient_update', [
        id,
        customer_group_id,
        notification_reason_id,
        notification_recipient_id,
        notification_channel_id,
        is_active,
    ]);

    return getFirstRow(resultSets);

};

export const deactivateNotificationReasonRecipient = async (id) => {

    const resultSets = await executeSp('sp_notification_reason_recipient_deactivate', [
        id,
    ]);

    return getFirstRow(resultSets);

};
