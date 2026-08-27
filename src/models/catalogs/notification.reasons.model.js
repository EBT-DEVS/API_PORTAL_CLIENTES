import { executeSp } from '../../config/db/db.portal.config.js';

export const getNotificationReasons = async ({
    id = null,
    name = null,
    nameEs = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_cat_notification_reasons_get', [
        id,
        name,
        nameEs,
        isActive,
    ]);

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};
