import { executeSp } from '../../config/db/db.portal.config.js';

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

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};
