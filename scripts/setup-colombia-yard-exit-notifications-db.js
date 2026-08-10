import mysql from 'mysql2/promise';

import env from '../src/config/env/env.config.js';

const statements = [
    `CREATE TABLE IF NOT EXISTS cross_yard_exit_notification_recipients (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        email VARCHAR(150) NOT NULL,
        name VARCHAR(150) DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_cross_yard_exit_notification_recipients_email (email),
        KEY idx_cross_yard_exit_notification_recipients_active (is_active)
    )`,
    `CREATE TABLE IF NOT EXISTS cross_yard_exit_notifications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        cross_id BIGINT UNSIGNED NOT NULL,
        trailer_id VARCHAR(50) NOT NULL,
        mcleod_order_id VARCHAR(50) DEFAULT NULL,
        yard_name VARCHAR(120) NOT NULL,
        exit_at DATETIME NOT NULL,
        notification_type VARCHAR(50) NOT NULL DEFAULT 'COLOMBIA_YARD_EXIT',
        recipients_json JSON DEFAULT NULL,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_cross_yard_exit_notifications_once (cross_id, notification_type),
        KEY idx_cross_yard_exit_notifications_trailer (trailer_id),
        KEY idx_cross_yard_exit_notifications_exit_at (exit_at),
        CONSTRAINT fk_cross_yard_exit_notifications_cross
            FOREIGN KEY (cross_id) REFERENCES crosses(id)
    )`,
    `INSERT IGNORE INTO cross_yard_exit_notification_recipients (email, name, is_active)
     VALUES
        ('gmolina@ebtlogistics.com', 'Giovanni Molina', 1),
        ('lvaldez@ebtlogistics.com', 'L Valdez', 1)`,
    'DROP PROCEDURE IF EXISTS sp_cross_yard_exit_notification_recipients_get',
    `CREATE PROCEDURE sp_cross_yard_exit_notification_recipients_get(
        IN p_is_active TINYINT
    )
    BEGIN
        SELECT
            id,
            email,
            name,
            is_active,
            created_at,
            updated_at
        FROM cross_yard_exit_notification_recipients
        WHERE p_is_active IS NULL OR is_active = p_is_active
        ORDER BY email;
    END`,
    'DROP PROCEDURE IF EXISTS sp_cross_colombia_yard_exit_notifications_get_pending',
    `CREATE PROCEDURE sp_cross_colombia_yard_exit_notifications_get_pending()
    BEGIN
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
            yard.yard_name,
            yard.exit_at,
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
        INNER JOIN sysebtapps_prd_exchange.d31_yard_latest yard
            ON yard.unit = c.trailer_id
           AND yard.unit_kind = 'TRAILER'
           AND yard.deleted = 0
           AND yard.yard_name = 'Patio EBT (Colombia)'
           AND yard.order_mcleod = c.mcleod_order_id
           AND yard.last_event_type = 'EXIT'
           AND yard.exit_at IS NOT NULL
           AND yard.exit_at >= CURDATE()
           AND yard.exit_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
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
        ORDER BY yard.exit_at ASC;
    END`,
    'DROP PROCEDURE IF EXISTS sp_cross_yard_exit_notification_mark_sent',
    `CREATE PROCEDURE sp_cross_yard_exit_notification_mark_sent(
        IN p_cross_id BIGINT UNSIGNED,
        IN p_trailer_id VARCHAR(50),
        IN p_mcleod_order_id VARCHAR(50),
        IN p_yard_name VARCHAR(120),
        IN p_exit_at DATETIME,
        IN p_notification_type VARCHAR(50),
        IN p_recipients_json JSON
    )
    BEGIN
        INSERT INTO cross_yard_exit_notifications (
            cross_id,
            trailer_id,
            mcleod_order_id,
            yard_name,
            exit_at,
            notification_type,
            recipients_json,
            sent_at
        )
        VALUES (
            p_cross_id,
            p_trailer_id,
            p_mcleod_order_id,
            p_yard_name,
            p_exit_at,
            COALESCE(NULLIF(p_notification_type, ''), 'COLOMBIA_YARD_EXIT'),
            p_recipients_json,
            NOW()
        )
        ON DUPLICATE KEY UPDATE updated_at = NOW();

        SELECT
            id,
            cross_id,
            trailer_id,
            mcleod_order_id,
            yard_name,
            exit_at,
            notification_type,
            recipients_json,
            sent_at,
            created_at,
            updated_at
        FROM cross_yard_exit_notifications
        WHERE cross_id = p_cross_id
          AND notification_type = COALESCE(NULLIF(p_notification_type, ''), 'COLOMBIA_YARD_EXIT')
        LIMIT 1;
    END`,
];

const main = async () => {

    const connection = await mysql.createConnection({
        host: env.db.host,
        user: env.db.user,
        password: env.db.password,
        database: env.db.database,
    });

    try {
        for (const statement of statements) {
            await connection.query(statement);
        }

        console.log('[setup-colombia-yard-exit-notifications-db] listo');
    } finally {
        await connection.end();
    }

};

main().catch((error) => {
    console.error('[setup-colombia-yard-exit-notifications-db] error', {
        message: error.message,
        stack: error.stack,
    });

    process.exitCode = 1;
});
