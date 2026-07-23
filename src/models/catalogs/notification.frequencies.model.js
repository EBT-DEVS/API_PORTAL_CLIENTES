import { executeSp } from '../../config/db/db.portal.config.js';

export const getNotificationFrequencies = async ({
    id = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_cat_notification_frequencies_get', [
        id,
        isActive,
    ]);

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};
