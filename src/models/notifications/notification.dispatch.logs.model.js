import pool, { executeSp } from '../../config/db/db.portal.config.js';

const getFirstResultSet = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet)) || []
);

export const getNotificationDispatchLogs = async ({
    id = null,
    notification_reason_id = null,
    notification_channel_id = null,
    customer_group_id = null,
} = {}) => {

    const resultSets = await executeSp('sp_notification_dispatch_logs_get', [
        id,
        notification_reason_id,
        notification_channel_id,
        customer_group_id,
    ]);

    return getFirstResultSet(resultSets);

};

const getFirstRow = (resultSets = []) => (
    getFirstResultSet(resultSets)[0] || null
);

export const insertNotificationDispatchLog = async ({
    notification_reason_id = null,
    notification_channel_id = null,
    customer_group_id = null,
    entity_id = null,
    subject = null,
    recipients_json = null,
    status = 'SENT',
    sent_at = null,
} = {}) => {

    const resultSets = await executeSp('sp_notification_dispatch_log_insert', [
        notification_reason_id,
        notification_channel_id,
        customer_group_id,
        entity_id,
        subject,
        recipients_json,
        status,
        sent_at,
    ]);

    return getFirstRow(resultSets);

};

export const getRecentCustomsLightDispatchLog = async ({
    trailer_id,
    customs_country,
    light,
    notification_reason_code = 'CUSTOMS_RED_LIGHT',
} = {}) => {

    const lightIcon = {
        RED: '🔴',
        YELLOW: '🟡',
    }[light] || null;

    const [rows] = await pool.execute(
        `
            SELECT
                ndl.id,
                ndl.entity_id,
                ndl.subject,
                ndl.status,
                ndl.sent_at,
                c.trailer_id,
                COALESCE(
                    cc.customs_country,
                    CASE cs.stop_code
                        WHEN 'MX_CUSTOMS' THEN 'MX'
                        WHEN 'US_CUSTOMS' THEN 'US'
                        ELSE NULL
                    END
                ) AS customs_country
            FROM notification_dispatch_logs ndl
            INNER JOIN cross_stops cs
                ON cs.id = ndl.entity_id
            INNER JOIN crosses c
                ON c.id = cs.cross_id
            LEFT JOIN cross_customs cc
                ON cc.cross_stop_id = cs.id
            WHERE ndl.notification_reason_code = ?
              AND ndl.status = 'SENT'
              AND c.trailer_id = ?
              AND COALESCE(
                    cc.customs_country,
                    CASE cs.stop_code
                        WHEN 'MX_CUSTOMS' THEN 'MX'
                        WHEN 'US_CUSTOMS' THEN 'US'
                        ELSE NULL
                    END
                  ) = ?
              AND (? IS NULL OR ndl.subject LIKE CONCAT('%', ?, '%'))
              AND ndl.sent_at >= CURDATE()
              AND ndl.sent_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            ORDER BY ndl.sent_at DESC, ndl.id DESC
            LIMIT 1
        `,
        [
            notification_reason_code,
            trailer_id,
            customs_country,
            lightIcon,
            lightIcon,
        ]
    );

    return rows[0] || null;

};
