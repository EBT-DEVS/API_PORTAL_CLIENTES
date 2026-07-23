import { executeSp } from '../../config/db/db.portal.config.js';

export const getCustomerGroupCrossPlants = async (isActive = 1) => {

    const resultSets = await executeSp('sp_customer_group_cross_plants_get', [
        isActive,
    ]);

    return resultSets[0] || [];

};
