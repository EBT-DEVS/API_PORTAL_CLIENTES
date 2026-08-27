import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstResultSet = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet)) || []
);

const getFirstRow = (resultSets = []) => (
    getFirstResultSet(resultSets)[0] || null
);

export const getNotificationRecipients = async ({
    id = null,
    notificationChannelId = null,
    customerCode = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_cat_notification_recipients_get', [
        id,
        notificationChannelId,
        customerCode,
        isActive,
    ]);

    return getFirstResultSet(resultSets);

};

export const insertNotificationRecipient = async ({
    customerCode = null,
    notificationChannelId,
    recipientValue,
    isActive = 1,
} = {}) => {

    const resultSets = await executeSp('sp_cat_notification_recipient_insert', [
        customerCode,
        notificationChannelId,
        recipientValue,
        isActive,
    ]);

    return getFirstRow(resultSets);

};

export const updateNotificationRecipient = async ({
    id,
    customerCode = null,
    notificationChannelId,
    recipientValue,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_cat_notification_recipient_update', [
        id,
        customerCode,
        notificationChannelId,
        recipientValue,
        isActive,
    ]);

    return getFirstRow(resultSets);

};
