import { executeSp } from '../../config/db/db.portal.config.js';

export const getCustomerGroupCrossPlants = async (options = {}) => {

    const filters = typeof options === 'object'
        ? options
        : { isActive: options ?? 1 };

    const {
        customerGroupId = null,
        locationName = null,
        isActive = 1,
    } = filters;

    const resultSets = await executeSp('sp_customer_group_cross_plants_get', [
        customerGroupId,
        locationName,
        isActive,
    ]);

    return resultSets[0] || [];

};

export const insertCustomerGroupCrossPlant = async ({
    customerGroupId,
    plantLocationCode,
    plantLocationName = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_customer_group_cross_plant_insert', [
        customerGroupId,
        plantLocationCode,
        plantLocationName,
        isActive,
    ]);

    return (resultSets.find((resultSet) => Array.isArray(resultSet)) || [])[0] || null;

};

export const updateCustomerGroupCrossPlant = async ({
    id,
    customerGroupId,
    plantLocationCode,
    plantLocationName = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_customer_group_cross_plant_update', [
        id,
        customerGroupId,
        plantLocationCode,
        plantLocationName,
        isActive,
    ]);

    return (resultSets.find((resultSet) => Array.isArray(resultSet)) || [])[0] || null;

};
