import pool, { executeSp } from '../../config/db/db.portal.config.js';

const getFirstRow = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet) && resultSet.length)?.[0] || null
);

const normalizeCode = (value) => (
    value == null ? null : String(value).trim().toUpperCase()
);

const shouldIgnoreMcleodTimes = ({
    source = 'MCLEOD',
    stop_code = null,
    stop_name = null,
} = {}) => (
    String(source || 'MCLEOD').trim().toUpperCase() === 'MCLEOD'
    && (
        ['PENSIEBT', 'MX_CUSTOMS', 'US_CUSTOMS', 'EBT_YARD', 'EBT YARD'].includes(normalizeCode(stop_code))
        || normalizeCode(stop_name) === 'EBT YARD'
    )
);

const resolveArrivalStatusValue = ({
    ignoredMcleodTimes = false,
    arrival_status = null,
} = {}) => (
    ignoredMcleodTimes ? 'PENDING' : arrival_status
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

    const ignoredMcleodTimes = shouldIgnoreMcleodTimes({ source, stop_code, stop_name });
    const actualArrivalValue = ignoredMcleodTimes ? null : actual_arrival;
    const actualDepartureValue = ignoredMcleodTimes ? null : actual_departure;
    const arrivalStatusValue = resolveArrivalStatusValue({
        ignoredMcleodTimes,
        arrival_status,
    });

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
        actualArrivalValue,
        actualDepartureValue,
        arrivalStatusValue,
        ignoredMcleodTimes ? 0 : is_completed,
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

export const updateCrossStopEta = async ({
    cross_stop_id,
    eta = null,
} = {}) => {

    await pool.execute(
        `
            UPDATE cross_stops
            SET
                eta = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `,
        [
            eta,
            cross_stop_id,
        ]
    );

    return {
        cross_stop_id,
        eta,
    };

};

export const updateCrossCustomsStopTimes = async ({
    cross_stop_id,
    actual_arrival = null,
    actual_arrival_source = 'GPS_GEOFENCE',
    actual_arrival_source_record_id = null,
    actual_departure = null,
    actual_departure_source = 'GPS_GEOFENCE',
    actual_departure_source_record_id = null,
} = {}) => {

    const arrivalStatus = actual_departure
        ? 'ON_TIME'
        : actual_arrival
            ? 'UNKNOWN'
            : 'PENDING';
    const isCompleted = actual_departure ? 1 : 0;

    await pool.execute(
        `
            UPDATE cross_stops
            SET
                actual_arrival = ?,
                actual_arrival_source = ?,
                actual_arrival_source_record_id = ?,
                actual_departure = ?,
                actual_departure_source = ?,
                actual_departure_source_record_id = ?,
                arrival_status = ?,
                is_completed = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
        `,
        [
            actual_arrival,
            actual_arrival_source,
            actual_arrival_source_record_id,
            actual_departure,
            actual_departure_source,
            actual_departure_source_record_id,
            arrivalStatus,
            isCompleted,
            cross_stop_id,
        ]
    );

    return {
        cross_stop_id,
        actual_arrival,
        actual_arrival_source,
        actual_arrival_source_record_id,
        actual_departure,
        actual_departure_source,
        actual_departure_source_record_id,
        arrival_status: arrivalStatus,
        is_completed: isCompleted,
    };

};

export const updateCrossSpecialStopGeofenceTimes = async ({
    cross_stop_id,
    stop_codes = ['PENSIEBT', 'MX_CUSTOMS', 'US_CUSTOMS', 'EBT_YARD'],
    stop_names = [],
    actual_arrival = null,
    actual_arrival_source = 'GPS_GEOFENCE',
    actual_arrival_source_record_id = null,
    actual_departure = null,
    actual_departure_source = 'GPS_GEOFENCE',
    actual_departure_source_record_id = null,
} = {}) => {

    const allowedStopCodes = Array.isArray(stop_codes) && stop_codes.length
        ? stop_codes
        : ['PENSIEBT', 'MX_CUSTOMS', 'US_CUSTOMS', 'EBT_YARD'];
    const allowedStopNames = Array.isArray(stop_names) && stop_names.length
        ? stop_names
        : [];
    const codePlaceholders = allowedStopCodes.map(() => '?').join(', ');
    const namePlaceholders = allowedStopNames.map(() => '?').join(', ');
    const stopFilters = [
        `stop_code IN (${codePlaceholders})`,
        ...(allowedStopNames.length ? [`stop_name IN (${namePlaceholders})`] : []),
    ].join(' OR ');
    const arrivalStatus = actual_departure
        ? 'ON_TIME'
        : actual_arrival
            ? 'UNKNOWN'
            : 'PENDING';
    const isCompleted = actual_departure ? 1 : 0;

    await pool.execute(
        `
            UPDATE cross_stops
            SET
                actual_arrival = ?,
                actual_arrival_source = ?,
                actual_arrival_source_record_id = ?,
                actual_departure = ?,
                actual_departure_source = ?,
                actual_departure_source_record_id = ?,
                arrival_status = ?,
                is_completed = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND (${stopFilters})
        `,
        [
            actual_arrival,
            actual_arrival_source,
            actual_arrival_source_record_id,
            actual_departure,
            actual_departure_source,
            actual_departure_source_record_id,
            arrivalStatus,
            isCompleted,
            cross_stop_id,
            ...allowedStopCodes,
            ...allowedStopNames,
        ]
    );

    return {
        cross_stop_id,
        actual_arrival,
        actual_arrival_source,
        actual_arrival_source_record_id,
        actual_departure,
        actual_departure_source,
        actual_departure_source_record_id,
        arrival_status: arrivalStatus,
        is_completed: isCompleted,
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

    const ignoredMcleodTimes = shouldIgnoreMcleodTimes({ source: 'MCLEOD', stop_code, stop_name });
    const actualArrivalValue = ignoredMcleodTimes ? null : actual_arrival;
    const actualDepartureValue = ignoredMcleodTimes ? null : actual_departure;
    const arrivalStatusValue = resolveArrivalStatusValue({
        ignoredMcleodTimes,
        arrival_status,
    });

    await executeSp('sp_cross_stop_update_from_mcleod', [
        cross_id,
        sequence,
        stop_code,
        stop_name,
        latitude,
        longitude,
        eta,
        sched_arrive,
        actualArrivalValue,
        actualDepartureValue,
        arrivalStatusValue,
        ignoredMcleodTimes ? 0 : is_completed,
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

    const ignoredMcleodTimes = shouldIgnoreMcleodTimes({ source, stop_code, stop_name });
    const actualArrivalValue = ignoredMcleodTimes ? null : actual_arrival;
    const actualDepartureValue = ignoredMcleodTimes ? null : actual_departure;
    const arrivalStatusValue = resolveArrivalStatusValue({
        ignoredMcleodTimes,
        arrival_status,
    });

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
        actualArrivalValue,
        actualDepartureValue,
        arrivalStatusValue,
        ignoredMcleodTimes ? 0 : is_completed,
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
