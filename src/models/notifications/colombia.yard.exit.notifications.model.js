import pool, { executeSp } from '../../config/db/db.portal.config.js';
import { getTkGeofenceEvents } from '../db_gps/tk.events.model.js';

export { getTkGeofenceEvents };

export const getEbtColombiaGeofenceEvents = async ({
    vehicle,
    start,
    end,
} = {}) => getTkGeofenceEvents({
    vehicle,
    geofence: 'EBT Colombia',
    start,
    end,
});

export const getColombiaYardGeofenceEventCandidates = async () => {

    const [rows] = await pool.execute(`
        SELECT
            c.id AS cross_id,
            c.customer_group_id,
            c.trailer_id,
            c.mcleod_order_id,
            c.po_number,
            c.mcleod_customer_id,
            mc.customer_name,
            c.cross_status_id,
            cs.code AS status_code,
            cs.name AS status_name,
            'Patio EBT (Colombia)' AS yard_name,
            origin_stop.id AS origin_stop_id,
            origin_stop.sequence AS origin_sequence,
            origin_stop.stop_code AS origin_stop_code,
            origin_stop.stop_name AS origin_stop_name,
            pension_stop.id AS pension_stop_id,
            pension_stop.id AS arrival_stop_id,
            pension_stop.id AS departure_stop_id,
            pension_stop.sequence AS pension_sequence,
            pension_stop.sequence AS arrival_sequence,
            pension_stop.sequence AS departure_sequence,
            pension_stop.stop_code AS pension_stop_code,
            pension_stop.stop_code AS arrival_stop_code,
            pension_stop.stop_code AS departure_stop_code,
            pension_stop.stop_name AS pension_stop_name,
            pension_stop.stop_name AS arrival_stop_name,
            pension_stop.stop_name AS departure_stop_name,
            pension_stop.actual_arrival AS pension_actual_arrival,
            pension_stop.actual_arrival_source AS pension_actual_arrival_source,
            pension_stop.actual_arrival_source_record_id AS pension_actual_arrival_source_record_id,
            pension_stop.actual_departure AS pension_actual_departure,
            pension_stop.actual_departure_source AS pension_actual_departure_source,
            pension_stop.actual_departure_source_record_id AS pension_actual_departure_source_record_id,
            destination_stop.id AS destination_stop_id,
            destination_stop.sequence AS destination_sequence,
            destination_stop.stop_code AS destination_stop_code,
            destination_stop.stop_name AS destination_stop_name,
            destination_stop.latitude AS destination_latitude,
            destination_stop.longitude AS destination_longitude,
            (
                SELECT COUNT(*)
                FROM notification_dispatch_logs sent
                WHERE sent.entity_id = c.id
                  AND sent.notification_reason_code = 'COLOMBIA_YARD_EXIT'
                  AND sent.status = 'SENT'
            ) AS notification_sent_count
        FROM crosses c
        INNER JOIN cat_cross_statuses cs
            ON cs.id = c.cross_status_id
        LEFT JOIN sysebtapps_prd_mcleod.customers mc
            ON mc.customer_id = c.mcleod_customer_id
        INNER JOIN cross_stops pension_stop
            ON pension_stop.cross_id = c.id
           AND pension_stop.stop_code = 'PENSIEBT'
        INNER JOIN (
            SELECT
                cross_id,
                MIN(sequence) AS origin_sequence
            FROM cross_stops
            WHERE source = 'MCLEOD'
            GROUP BY cross_id
        ) first_stop
            ON first_stop.cross_id = c.id
        INNER JOIN cross_stops origin_stop
            ON origin_stop.cross_id = c.id
           AND origin_stop.sequence = first_stop.origin_sequence
        INNER JOIN (
            SELECT
                cross_id,
                MAX(sequence) AS last_customs_sequence
            FROM cross_stops
            WHERE stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
            GROUP BY cross_id
        ) last_customs
            ON last_customs.cross_id = c.id
        INNER JOIN cross_stops destination_stop
            ON destination_stop.cross_id = c.id
           AND destination_stop.sequence = last_customs.last_customs_sequence + 1
           AND destination_stop.actual_arrival IS NULL
        WHERE c.cross_status_id NOT IN (12, 13)
          AND c.is_cross = 1
          AND c.trailer_id IS NOT NULL
          AND c.trailer_id <> ''
        ORDER BY c.updated_at ASC
    `);

    return rows;

};

export const getPendingColombiaYardExitNotifications = async () => {

    const resultSets = await executeSp('sp_cross_colombia_yard_exit_notifications_get_pending');

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};

export const getColombiaYardExitNotificationFallbackCandidates = async () => {

    const [rows] = await pool.execute(`
        SELECT
            c.id AS cross_id,
            c.customer_group_id,
            c.trailer_id,
            c.mcleod_order_id,
            c.po_number,
            c.mcleod_customer_id,
            mc.customer_name,
            c.cross_status_id,
            cs.code AS status_code,
            cs.name AS status_name,
            'Patio EBT (Colombia)' AS yard_name,
            NOW() AS exit_at,
            NULL AS source_record_id,
            origin_stop.id AS origin_stop_id,
            origin_stop.sequence AS origin_sequence,
            origin_stop.stop_code AS origin_stop_code,
            origin_stop.stop_name AS origin_stop_name,
            departure_stop.id AS departure_stop_id,
            departure_stop.sequence AS departure_sequence,
            departure_stop.stop_code AS departure_stop_code,
            departure_stop.stop_name AS departure_stop_name,
            destination_stop.id AS destination_stop_id,
            destination_stop.sequence AS destination_sequence,
            destination_stop.stop_code AS destination_stop_code,
            destination_stop.stop_name AS destination_stop_name,
            destination_stop.latitude AS destination_latitude,
            destination_stop.longitude AS destination_longitude
        FROM crosses c
        INNER JOIN cat_cross_statuses cs
            ON cs.id = c.cross_status_id
        LEFT JOIN sysebtapps_prd_mcleod.customers mc
            ON mc.customer_id = c.mcleod_customer_id
        INNER JOIN (
            SELECT
                cross_id,
                MIN(sequence) AS origin_sequence
            FROM cross_stops
            WHERE source = 'MCLEOD'
            GROUP BY cross_id
        ) first_stop
            ON first_stop.cross_id = c.id
        INNER JOIN cross_stops origin_stop
            ON origin_stop.cross_id = c.id
           AND origin_stop.sequence = first_stop.origin_sequence
        INNER JOIN (
            SELECT
                cross_id,
                MIN(sequence) AS first_customs_sequence
            FROM cross_stops
            WHERE stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
            GROUP BY cross_id
        ) first_customs
            ON first_customs.cross_id = c.id
        INNER JOIN cross_stops departure_stop
            ON departure_stop.cross_id = c.id
           AND departure_stop.sequence = first_customs.first_customs_sequence - 1
        INNER JOIN (
            SELECT
                cross_id,
                MAX(sequence) AS last_customs_sequence
            FROM cross_stops
            WHERE stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
            GROUP BY cross_id
        ) last_customs
            ON last_customs.cross_id = c.id
        INNER JOIN cross_stops destination_stop
            ON destination_stop.cross_id = c.id
           AND destination_stop.sequence = last_customs.last_customs_sequence + 1
           AND destination_stop.actual_arrival IS NULL
        WHERE c.cross_status_id NOT IN (12, 13)
          AND c.is_cross = 1
          AND c.trailer_id IS NOT NULL
          AND c.trailer_id <> ''
          AND NOT EXISTS (
              SELECT 1
              FROM notification_dispatch_logs sent
              WHERE sent.entity_id = c.id
                AND sent.notification_reason_code = 'COLOMBIA_YARD_EXIT'
                AND sent.status = 'SENT'
          )
        ORDER BY c.updated_at ASC
    `);

    return rows;

};

export const getPendingColombiaYardEntryArrivals = async () => {

    const [rows] = await pool.execute(`
        SELECT
            c.id AS cross_id,
            c.customer_group_id,
            c.trailer_id,
            c.mcleod_order_id,
            c.po_number,
            c.mcleod_customer_id,
            mc.customer_name,
            c.cross_status_id,
            cs.code AS status_code,
            cs.name AS status_name,
            yard.yard_name,
            yard.entry_at,
            NULL AS source_record_id,
            origin_stop.id AS origin_stop_id,
            origin_stop.sequence AS origin_sequence,
            origin_stop.stop_code AS origin_stop_code,
            origin_stop.stop_name AS origin_stop_name,
            arrival_stop.id AS arrival_stop_id,
            arrival_stop.sequence AS arrival_sequence,
            arrival_stop.stop_code AS arrival_stop_code,
            arrival_stop.stop_name AS arrival_stop_name
        FROM crosses c
        INNER JOIN cat_cross_statuses cs
            ON cs.id = c.cross_status_id
        INNER JOIN sysebtapps_prd_exchange.d31_yard_latest yard
            ON yard.unit = c.trailer_id
           AND yard.unit_kind = 'TRAILER'
           AND yard.deleted = 0
           AND yard.yard_name = 'Patio EBT (Colombia)'
           AND yard.order_mcleod = c.mcleod_order_id
           AND yard.last_event_type = 'ENTRY'
           AND yard.entry_at IS NOT NULL
           AND yard.entry_at >= CURDATE()
           AND yard.entry_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        LEFT JOIN sysebtapps_prd_mcleod.customers mc
            ON mc.customer_id = c.mcleod_customer_id
        INNER JOIN (
            SELECT
                cross_id,
                MIN(sequence) AS origin_sequence
            FROM cross_stops
            WHERE source = 'MCLEOD'
            GROUP BY cross_id
        ) first_stop
            ON first_stop.cross_id = c.id
        INNER JOIN cross_stops origin_stop
            ON origin_stop.cross_id = c.id
           AND origin_stop.sequence = first_stop.origin_sequence
        INNER JOIN (
            SELECT
                cross_id,
                MIN(sequence) AS first_customs_sequence
            FROM cross_stops
            WHERE stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
            GROUP BY cross_id
        ) first_customs
            ON first_customs.cross_id = c.id
        INNER JOIN cross_stops arrival_stop
            ON arrival_stop.cross_id = c.id
           AND arrival_stop.sequence = first_customs.first_customs_sequence - 1
           AND arrival_stop.actual_arrival IS NULL
        INNER JOIN (
            SELECT
                cross_id,
                MAX(sequence) AS last_customs_sequence
            FROM cross_stops
            WHERE stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
            GROUP BY cross_id
        ) last_customs
            ON last_customs.cross_id = c.id
        INNER JOIN cross_stops destination_stop
            ON destination_stop.cross_id = c.id
           AND destination_stop.sequence = last_customs.last_customs_sequence + 1
           AND destination_stop.actual_arrival IS NULL
        WHERE c.cross_status_id NOT IN (12, 13)
          AND c.is_cross = 1
          AND c.trailer_id IS NOT NULL
          AND c.trailer_id <> ''
        ORDER BY yard.entry_at ASC
    `);

    return rows;

};

export const getColombiaYardEntryArrivalFallbackCandidates = async () => {

    const [rows] = await pool.execute(`
        SELECT
            c.id AS cross_id,
            c.customer_group_id,
            c.trailer_id,
            c.mcleod_order_id,
            c.po_number,
            c.mcleod_customer_id,
            mc.customer_name,
            c.cross_status_id,
            cs.code AS status_code,
            cs.name AS status_name,
            'Patio EBT (Colombia)' AS yard_name,
            NOW() AS entry_at,
            NULL AS source_record_id,
            origin_stop.id AS origin_stop_id,
            origin_stop.sequence AS origin_sequence,
            origin_stop.stop_code AS origin_stop_code,
            origin_stop.stop_name AS origin_stop_name,
            arrival_stop.id AS arrival_stop_id,
            arrival_stop.sequence AS arrival_sequence,
            arrival_stop.stop_code AS arrival_stop_code,
            arrival_stop.stop_name AS arrival_stop_name
        FROM crosses c
        INNER JOIN cat_cross_statuses cs
            ON cs.id = c.cross_status_id
        LEFT JOIN sysebtapps_prd_mcleod.customers mc
            ON mc.customer_id = c.mcleod_customer_id
        INNER JOIN (
            SELECT
                cross_id,
                MIN(sequence) AS origin_sequence
            FROM cross_stops
            WHERE source = 'MCLEOD'
            GROUP BY cross_id
        ) first_stop
            ON first_stop.cross_id = c.id
        INNER JOIN cross_stops origin_stop
            ON origin_stop.cross_id = c.id
           AND origin_stop.sequence = first_stop.origin_sequence
        INNER JOIN (
            SELECT
                cross_id,
                MIN(sequence) AS first_customs_sequence
            FROM cross_stops
            WHERE stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
            GROUP BY cross_id
        ) first_customs
            ON first_customs.cross_id = c.id
        INNER JOIN cross_stops arrival_stop
            ON arrival_stop.cross_id = c.id
           AND arrival_stop.sequence = first_customs.first_customs_sequence - 1
           AND arrival_stop.actual_arrival IS NULL
        INNER JOIN (
            SELECT
                cross_id,
                MAX(sequence) AS last_customs_sequence
            FROM cross_stops
            WHERE stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
            GROUP BY cross_id
        ) last_customs
            ON last_customs.cross_id = c.id
        INNER JOIN cross_stops destination_stop
            ON destination_stop.cross_id = c.id
           AND destination_stop.sequence = last_customs.last_customs_sequence + 1
           AND destination_stop.actual_arrival IS NULL
        WHERE c.cross_status_id NOT IN (12, 13)
          AND c.is_cross = 1
          AND c.trailer_id IS NOT NULL
          AND c.trailer_id <> ''
        ORDER BY c.updated_at ASC
    `);

    return rows;

};

export const updateColombiaOriginStopDeparture = async ({
    cross_stop_id,
    cross_id,
    actual_departure,
    actual_departure_source = 'YARD_EXIT',
    actual_departure_source_record_id = null,
} = {}) => {

    if (!cross_stop_id || !cross_id || !actual_departure) {
        return {
            updated: false,
            reason: 'missing_required_departure_data',
        };
    }

    const [result] = await pool.execute(
        `
            UPDATE cross_stops
            SET
                actual_departure = ?,
                actual_departure_source = ?,
                actual_departure_source_record_id = ?,
                arrival_status = 'ON_TIME',
                is_completed = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND cross_id = ?
        `,
        [
            actual_departure,
            actual_departure_source,
            actual_departure_source_record_id,
            cross_stop_id,
            cross_id,
        ]
    );

    const [rows] = await pool.execute(
        `
            SELECT
                id,
                cross_id,
                sequence,
                stop_code,
                stop_name,
                actual_departure,
                actual_departure_source,
                actual_departure_source_record_id,
                arrival_status,
                is_completed
            FROM cross_stops
            WHERE id = ?
              AND cross_id = ?
            LIMIT 1
        `,
        [
            cross_stop_id,
            cross_id,
        ]
    );

    return {
        updated: result.affectedRows > 0,
        affectedRows: result.affectedRows,
        stop: rows[0] || null,
    };

};

export const updateColombiaYardStopDeparture = async ({
    cross_stop_id,
    cross_id,
    actual_departure,
    actual_departure_source = 'GPS_GEOFENCE',
    actual_departure_source_record_id = null,
} = {}) => {

    if (!cross_stop_id || !cross_id || !actual_departure) {
        return {
            updated: false,
            reason: 'missing_required_departure_data',
        };
    }

    const [result] = await pool.execute(
        `
            UPDATE cross_stops
            SET
                actual_departure = ?,
                actual_departure_source = ?,
                actual_departure_source_record_id = ?,
                arrival_status = 'ON_TIME',
                is_completed = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND cross_id = ?
              AND stop_code = 'PENSIEBT'
        `,
        [
            actual_departure,
            actual_departure_source,
            actual_departure_source_record_id,
            cross_stop_id,
            cross_id,
        ]
    );

    return {
        updated: result.affectedRows > 0,
        affectedRows: result.affectedRows,
    };

};

export const clearColombiaYardStopDeparture = async ({
    cross_stop_id,
    cross_id,
} = {}) => {

    if (!cross_stop_id || !cross_id) {
        return {
            updated: false,
            reason: 'missing_required_departure_data',
        };
    }

    const [result] = await pool.execute(
        `
            UPDATE cross_stops
            SET
                actual_departure = NULL,
                actual_departure_source = 'GPS_GEOFENCE',
                actual_departure_source_record_id = NULL,
                arrival_status = CASE
                    WHEN actual_arrival IS NULL THEN 'PENDING'
                    ELSE 'ON_TIME'
                END,
                is_completed = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND cross_id = ?
              AND stop_code = 'PENSIEBT'
        `,
        [
            cross_stop_id,
            cross_id,
        ]
    );

    return {
        updated: result.affectedRows > 0,
        affectedRows: result.affectedRows,
    };

};

export const updateColombiaYardStopArrival = async ({
    cross_stop_id,
    cross_id,
    actual_arrival,
    actual_arrival_source = 'GPS_GEOFENCE',
    actual_arrival_source_record_id = null,
} = {}) => {

    if (!cross_stop_id || !cross_id || !actual_arrival) {
        return {
            updated: false,
            reason: 'missing_required_arrival_data',
        };
    }

    const [result] = await pool.execute(
        `
            UPDATE cross_stops
            SET
                actual_arrival = ?,
                actual_arrival_source = ?,
                actual_arrival_source_record_id = ?,
                arrival_status = 'ON_TIME',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND cross_id = ?
              AND (
                  actual_arrival IS NULL
                  OR UPPER(TRIM(actual_arrival_source)) = 'MCLEOD'
              )
        `,
        [
            actual_arrival,
            actual_arrival_source,
            actual_arrival_source_record_id,
            cross_stop_id,
            cross_id,
        ]
    );

    const [rows] = await pool.execute(
        `
            SELECT
                id,
                cross_id,
                sequence,
                stop_code,
                stop_name,
                actual_arrival,
                actual_arrival_source,
                actual_arrival_source_record_id,
                arrival_status,
                is_completed
            FROM cross_stops
            WHERE id = ?
              AND cross_id = ?
            LIMIT 1
        `,
        [
            cross_stop_id,
            cross_id,
        ]
    );

    return {
        updated: result.affectedRows > 0,
        affectedRows: result.affectedRows,
        stop: rows[0] || null,
    };

};
