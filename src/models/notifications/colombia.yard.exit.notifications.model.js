import pool, { executeSp } from '../../config/db/db.portal.config.js';

const getFirstRow = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet) && resultSet.length)?.[0] || null
);

export const getColombiaYardExitNotificationRecipients = async ({
    isActive = 1,
} = {}) => {

    const resultSets = await executeSp('sp_cross_yard_exit_notification_recipients_get', [
        isActive,
    ]);

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};

export const getPendingColombiaYardExitNotifications = async () => {

    const resultSets = await executeSp('sp_cross_colombia_yard_exit_notifications_get_pending');

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};

export const getColombiaYardExitNotificationFallbackCandidates = async () => {

    const [rows] = await pool.execute(`
        SELECT
            c.id AS cross_id,
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
            origin_stop.id AS origin_stop_id,
            origin_stop.sequence AS origin_sequence,
            origin_stop.stop_code AS origin_stop_code,
            origin_stop.stop_name AS origin_stop_name,
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
              FROM cross_yard_exit_notifications sent
              WHERE sent.cross_id = c.id
                AND sent.notification_type = 'COLOMBIA_YARD_EXIT'
          )
        ORDER BY c.updated_at ASC
    `);

    return rows;

};

export const markColombiaYardExitNotificationSent = async ({
    cross_id,
    trailer_id,
    mcleod_order_id,
    yard_name,
    exit_at,
    notification_type = 'COLOMBIA_YARD_EXIT',
    recipients_json = null,
} = {}) => {

    const resultSets = await executeSp('sp_cross_yard_exit_notification_mark_sent', [
        cross_id,
        trailer_id,
        mcleod_order_id,
        yard_name,
        exit_at,
        notification_type,
        recipients_json,
    ]);

    return getFirstRow(resultSets);

};

export const updateColombiaOriginStopDeparture = async ({
    cross_stop_id,
    cross_id,
    actual_departure,
    actual_departure_source = 'YARD_EXIT',
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
                arrival_status = 'ON_TIME',
                is_completed = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND cross_id = ?
        `,
        [
            actual_departure,
            actual_departure_source,
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
