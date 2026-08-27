import { executeSp } from '../../config/db/db.portal.config.js';

export const getCustomerGroups = async ({
    id = null,
    name = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_customer_groups_get', [
        id,
        name,
        isActive,
    ]);

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};

export const insertCustomerGroup = async ({
    code,
    name,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_customer_group_insert', [
        code,
        name,
        isActive,
    ]);

    return (resultSets.find((resultSet) => Array.isArray(resultSet)) || [])[0] || null;

};

export const updateCustomerGroup = async ({
    id,
    code,
    name,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_customer_group_update', [
        id,
        code,
        name,
        isActive,
    ]);

    return (resultSets.find((resultSet) => Array.isArray(resultSet)) || [])[0] || null;

};
