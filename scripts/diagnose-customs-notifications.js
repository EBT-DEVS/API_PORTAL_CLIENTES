import mysql from 'mysql2/promise';
import env from '../src/config/env/env.config.js';

const db = await mysql.createConnection({ host: env.db.host, user: env.db.user,
    password: env.db.password, database: env.db.database, connectTimeout: 20000,
    dateStrings: true });
try {
    const queries = process.argv[2] === 'detail' ? [
        ['latest_types', `SELECT event, MAX(date_event) AS latest, COUNT(*) AS total_since_22 FROM sysebtapps_prd_gps_data.telemetria_tk_events WHERE date_event >= '2026-10-22' GROUP BY event ORDER BY latest DESC`],
        ['last_geofences', `SELECT * FROM sysebtapps_prd_gps_data.telemetria_tk_events WHERE event IN ('Geofence Entry','Geofence Exit') ORDER BY id DESC LIMIT 15`],
        ['last_customs', `SELECT * FROM sysebtapps_prd_gps_data.telemetria_tk_events WHERE event = 'Geofence Entry' AND event_details IN ('Aduana 240, Mex','ADUANA MEXICANA COLOMBIA','Inicio Aduana Mexicana Colombia','Inicio Aduana 240 MEX') ORDER BY date_event DESC LIMIT 5`],
        ['last_dispatches', `SELECT id, entity_id, customer_group_id, status, sent_at, subject FROM notification_dispatch_logs WHERE notification_reason_code = 'COLOMBIA_YARD_EXIT' ORDER BY sent_at DESC LIMIT 5`],
        ['gps_tables', `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'sysebtapps_prd_gps_data' AND (TABLE_NAME LIKE '%tk%' OR TABLE_NAME LIKE '%event%' OR TABLE_NAME LIKE '%geofence%')`],
        ['recipients', `CALL sp_notification_reason_recipients_get(NULL, 'COLOMBIA_YARD_EXIT', 'EMAIL', 1)`],
    ] : process.argv[2] === 'tk' ? [
        ['tk_columns', 'SHOW COLUMNS FROM sysebtapps_prd_gps_data.telemetria_tk_events'],
        ['tk_indexes', 'SHOW INDEX FROM sysebtapps_prd_gps_data.telemetria_tk_events'],
        ['tk_daily', `SELECT DATE(date_event) AS day, event, COUNT(*) AS total, MAX(date_event) AS latest FROM sysebtapps_prd_gps_data.telemetria_tk_events WHERE date_event >= '2026-10-22' GROUP BY DATE(date_event), event ORDER BY day, event`],
        ['customs_daily', `SELECT DATE(date_event) AS day, event_details, event, COUNT(*) AS total, MAX(date_event) AS latest FROM sysebtapps_prd_gps_data.telemetria_tk_events WHERE date_event >= '2026-10-22' AND (event_details LIKE '%aduana%' OR event_details LIKE '%colombia%') GROUP BY DATE(date_event), event_details, event ORDER BY day, event_details, event`],
    ] : [
        ['clock', 'SELECT NOW() AS db_now, UTC_TIMESTAMP() AS utc_now, DATABASE() AS db, @@session.time_zone AS timezone'],
        ['tk_procedure', 'SHOW CREATE PROCEDURE sp_ebt_tk_geofence_events_get'],
        ['log_columns', 'SHOW COLUMNS FROM notification_dispatch_logs'],
        ['dispatch_daily', `SELECT DATE(sent_at) AS day, notification_reason_code, status, COUNT(*) AS total, MAX(sent_at) AS latest FROM notification_dispatch_logs WHERE sent_at >= '2026-10-22' GROUP BY DATE(sent_at), notification_reason_code, status ORDER BY day, notification_reason_code, status`],
        ['historical_sp_check', `CALL sp_ebt_tk_geofence_events_get('1580', 'ADUANA MEXICANA COLOMBIA', '2026-10-25 20:00:00', '2026-10-25 20:30:00')`],
        ['current_sp_check', `CALL sp_ebt_tk_geofence_events_get('1580', 'ADUANA MEXICANA COLOMBIA', UTC_TIMESTAMP() - INTERVAL 30 MINUTE, UTC_TIMESTAMP() + INTERVAL 30 MINUTE)`],
    ];
    for (const [label, sql, params = []] of queries) {
        try { const [rows] = await db.query({ sql, timeout: 60000 }, params); console.log(JSON.stringify({label, rows})); }
        catch (error) { console.log(JSON.stringify({label, error: error.message, code: error.code})); }
    }
} finally { await db.end(); }
