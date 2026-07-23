import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstRow = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet) && resultSet.length)?.[0] || null
);

export const getCrossAssignmentByEquipmentGroupOrMove = async ({
    equipmentGroupId = null,
    moveId = null,
} = {}) => {

    if (!equipmentGroupId && !moveId) {
        return null;
    }

    const resultSets = await executeSp('sp_cross_assignment_get_by_equipment_or_move', [
        equipmentGroupId,
        moveId,
    ]);

    return getFirstRow(resultSets);

};

export const insertCrossAssignmentIgnore = async ({
    cross_id = null,
    mcleod_order_id = null,
    equipment_group_id = null,
    move_id = null,
    origin_stop_id = null,
    origin_stop_sequence = null,
    destination_stop_id = null,
    destination_stop_sequence = null,
    trailer_id = null,
    tractor_id = null,
    driver_1_id = null,
    driver_2_id = null,
    is_team = 0,
    is_current = 1,
    assigned_at = null,
    released_at = null,
} = {}) => {

    const resultSets = await executeSp('sp_cross_assignment_insert_ignore', [
        cross_id,
        mcleod_order_id,
        equipment_group_id,
        move_id,
        origin_stop_id,
        origin_stop_sequence,
        destination_stop_id,
        destination_stop_sequence,
        trailer_id,
        tractor_id,
        driver_1_id,
        driver_2_id,
        is_team,
        is_current,
        assigned_at,
        released_at,
    ]);

    return getFirstRow(resultSets);

};

export const upsertCurrentCrossAssignment = async ({
    cross_id = null,
    mcleod_order_id = null,
    equipment_group_id = null,
    move_id = null,
    origin_stop_id = null,
    origin_stop_sequence = null,
    destination_stop_id = null,
    destination_stop_sequence = null,
    trailer_id = null,
    tractor_id = null,
    driver_1_id = null,
    driver_2_id = null,
    is_team = 0,
    assigned_at = null,
    released_at = null,
} = {}) => {

    await executeSp('sp_cross_assignment_upsert_current', [
        cross_id,
        mcleod_order_id,
        equipment_group_id,
        move_id,
        origin_stop_id,
        origin_stop_sequence,
        destination_stop_id,
        destination_stop_sequence,
        trailer_id,
        tractor_id,
        driver_1_id,
        driver_2_id,
        is_team,
        assigned_at,
        released_at,
    ]);

    return {
        cross_id,
        move_id,
        equipment_group_id,
    };

};
