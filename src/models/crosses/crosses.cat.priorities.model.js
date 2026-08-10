import { executeSp } from '../../config/db/db.portal.config.js';

export const getCrossPriorities = async ({
    id = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_cat_cross_priorities_get', [
        id,
        isActive,
    ]);

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};
