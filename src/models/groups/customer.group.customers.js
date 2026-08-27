import { executeSp } from '../../config/db/db.portal.config.js';

export const getCustomerGroupCustomers = async (options = {}) => {

    const filters = typeof options === 'object'
        ? options
        : { isActive: options ?? 1 };

    const {
        id = null,
        customerGroupId = null,
        customerName = null,
        isActive = 1,
    } = filters;

    const resultSets = await executeSp('sp_customer_group_customers_get', [
        id,
        customerGroupId,
        customerName,
        isActive,
    ]);

    return resultSets[0] || [];

};

export const insertCustomerGroupCustomer = async ({
    customerGroupId,
    mcleodCustomerCode,
    mcleodCustomerName = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_customer_group_customer_insert', [
        customerGroupId,
        mcleodCustomerCode,
        mcleodCustomerName,
        isActive,
    ]);

    return (resultSets.find((resultSet) => Array.isArray(resultSet)) || [])[0] || null;

};

export const updateCustomerGroupCustomer = async ({
    id,
    customerGroupId,
    mcleodCustomerCode,
    mcleodCustomerName = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_customer_group_customer_update', [
        id,
        customerGroupId,
        mcleodCustomerCode,
        mcleodCustomerName,
        isActive,
    ]);

    return (resultSets.find((resultSet) => Array.isArray(resultSet)) || [])[0] || null;

};
