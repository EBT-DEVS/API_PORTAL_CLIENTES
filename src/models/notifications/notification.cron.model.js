import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstResultSet = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet)) || []
);

const getFirstRow = (resultSets = []) => (
    getFirstResultSet(resultSets)[0] || null
);

export const getActiveNotificationSubscriptions = async () => {

    const resultSets = await executeSp('sp_notification_subscriptions_get_active');

    return getFirstResultSet(resultSets);

};

export const deactivateNotificationSubscription = async (subscriptionId) => {

    const resultSets = await executeSp('sp_notification_subscriptions_deactivate', [
        subscriptionId,
    ]);

    return getFirstRow(resultSets);

};

export const markNotificationSubscriptionSent = async (subscriptionId) => {

    const resultSets = await executeSp('sp_notification_subscriptions_mark_sent', [
        subscriptionId,
    ]);

    return getFirstRow(resultSets);

};
