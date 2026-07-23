import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstRow = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet) && resultSet.length)?.[0] || null
);

export const insertCrossIgnore = async ({
    customer_group_id,
    cross_status_id,
    priority_id,
    mcleod_order_id,
    po_number = null,
    mcleod_customer_id = null,
    trailer_id = null,
    min_temperature = null,
    max_temperature = null,
    started_at = null,
    completed_at = null,
    is_cross = 0,
} = {}) => {

    const resultSets = await executeSp('sp_cross_insert_ignore', [
        customer_group_id,
        cross_status_id,
        priority_id,
        mcleod_order_id,
        po_number,
        mcleod_customer_id,
        trailer_id,
        min_temperature,
        max_temperature,
        started_at,
        completed_at,
        is_cross,
    ]);

    return getFirstRow(resultSets);

};

export const updateCrossFromMcleod = async ({
    cross_id,
    cross_status_id,
    priority_id,
    po_number = null,
    mcleod_customer_id = null,
    trailer_id = null,
    min_temperature = null,
    max_temperature = null,
    started_at = null,
    completed_at = null,
    is_cross = 0,
} = {}) => {

    await executeSp('sp_cross_update_from_mcleod', [
        cross_id,
        cross_status_id,
        priority_id,
        po_number,
        mcleod_customer_id,
        trailer_id,
        min_temperature,
        max_temperature,
        started_at,
        completed_at,
        is_cross,
    ]);

    return {
        cross_id,
        cross_status_id,
    };

};

export const getActiveCrossesData = async ({
    customerCode = null,
    customerGroupId = null,
    isCross = null,
    trailerId = null,
    poNumber = null,
    start = null,
    end = null,
} = {}) => {

    const resultSets = await executeSp('sp_cross_get_active_data', [
        customerCode,
        customerGroupId,
        isCross,
        trailerId,
        start,
        end,
        poNumber,
    ]);

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};

export const getActiveCrossesForUpdate = async () => {

    const resultSets = await executeSp('sp_cross_get_active_for_update');

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};

export const getCrossDetailById = async (crossId) => {

    const resultSets = await executeSp('sp_cross_get_detail_by_id', [
        crossId,
    ]);
    const dataSets = resultSets.filter((resultSet) => Array.isArray(resultSet));
    const [crossRows = [], stopRows = [], equipmentRows = [], gpsRows = []] = dataSets;
    const cross = crossRows[0] || null;

    if (!cross) {
        return null;
    }

    return {
        cross,
        stops: stopRows,
        equipment: equipmentRows,
        gps: gpsRows[0] || null,
    };

};
