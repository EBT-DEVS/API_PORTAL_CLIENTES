import pool, { executeSp } from '../../config/db/db.portal.config.js';

export const upsertCrossCustoms = async ({
    cross_stop_id,
    customs_country,
    light = null,
    papers_ready = 0,
    comments = null,
} = {}) => {

    await executeSp('sp__cross_customs_upsert', [
        cross_stop_id,
        customs_country,
        light,
        papers_ready,
        comments,
    ]);

    return {
        cross_stop_id,
        customs_country,
        light,
        papers_ready,
        comments,
    };

};

export const getCrossCustomsNotificationContext = async (crossStopId) => {

    const [rows] = await pool.execute(
        `
            SELECT
                cs.id AS cross_stop_id,
                cs.cross_id,
                cs.stop_code,
                cs.stop_name,
                cs.sequence,
                c.customer_group_id,
                c.trailer_id,
                c.mcleod_order_id,
                c.po_number,
                cc.comments
            FROM cross_stops cs
            INNER JOIN crosses c
                ON c.id = cs.cross_id
            LEFT JOIN cross_customs cc
                ON cc.cross_stop_id = cs.id
            WHERE cs.id = ?
            LIMIT 1
        `,
        [crossStopId]
    );

    return rows[0] || null;

};
