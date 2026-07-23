import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstRow = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet) && resultSet.length)?.[0] || null
);

export const insertCrossStopIgnore = async ({
    cross_id = null,
    mcleod_order_id = null,
    sequence,
    source = 'MCLEOD',
    stop_code = null,
    stop_name,
    latitude = null,
    longitude = null,
    eta = null,
    sched_arrive = null,
    actual_arrival = null,
    actual_departure = null,
    arrival_status = 'PENDING',
    is_completed = 0,
} = {}) => {

    const resultSets = await executeSp('sp_cross_stop_insert_ignore', [
        cross_id,
        mcleod_order_id,
        sequence,
        source,
        stop_code,
        stop_name,
        latitude,
        longitude,
        eta,
        sched_arrive,
        actual_arrival,
        actual_departure,
        arrival_status,
        is_completed,
    ]);

    return getFirstRow(resultSets);

};

export const updateCrossStopTimes = async ({
    cross_stop_id,
    actual_arrival = null,
    actual_departure = null,
} = {}) => {

    await executeSp('sp_cross_stop_update_times', [
        cross_stop_id,
        actual_arrival,
        actual_departure,
    ]);

    return {
        cross_stop_id,
        actual_arrival,
        actual_departure,
    };

};

export const updateCrossStopFromMcleod = async ({
    cross_id,
    sequence,
    stop_code = null,
    stop_name = null,
    latitude = null,
    longitude = null,
    eta = null,
    sched_arrive = null,
    actual_arrival = null,
    actual_departure = null,
    arrival_status = null,
    is_completed = null,
} = {}) => {

    await executeSp('sp_cross_stop_update_from_mcleod', [
        cross_id,
        sequence,
        stop_code,
        stop_name,
        latitude,
        longitude,
        eta,
        sched_arrive,
        actual_arrival,
        actual_departure,
        arrival_status,
        is_completed,
    ]);

    return {
        cross_id,
        sequence,
    };

};

export const upsertCrossStopSync = async ({
    cross_id,
    sequence,
    source = 'MCLEOD',
    stop_code = null,
    stop_name = null,
    latitude = null,
    longitude = null,
    eta = null,
    sched_arrive = null,
    actual_arrival = null,
    actual_departure = null,
    arrival_status = null,
    is_completed = null,
} = {}) => {

    const resultSets = await executeSp('sp_cross_stop_upsert_sync', [
        cross_id,
        sequence,
        source,
        stop_code,
        stop_name,
        latitude,
        longitude,
        eta,
        sched_arrive,
        actual_arrival,
        actual_departure,
        arrival_status,
        is_completed,
    ]);

    return getFirstRow(resultSets);

};

export const deleteUnreferencedCrossStopsAfterSequence = async ({
    cross_id,
    max_sequence,
} = {}) => {

    const resultSets = await executeSp('sp_cross_stops_delete_unreferenced_after_sequence', [
        cross_id,
        max_sequence,
    ]);

    return getFirstRow(resultSets) || { deleted_count: 0 };

};
