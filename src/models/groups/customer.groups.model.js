import { executeSp } from '../../config/db/db.portal.config.js';

export const getCustomerGroups = async ({
    id = null,
    code = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_customer_groups_get', [
        id,
        code,
        isActive,
    ]);

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};
