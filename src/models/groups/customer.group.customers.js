import { executeSp } from '../../config/db/db.portal.config.js';

export const getCustomerGroupCustomers = async (isActive = 1) => {

    const resultSets = await executeSp('sp_customer_group_customers_get', [
        isActive,
    ]);

    return resultSets[0] || [];

};
