import pool, { closeDbPool } from '../src/config/db/db.portal.config.js';

const US_STATE_CODES = new Set([
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
    'DC',
]);

const CUSTOMS_STOP_CODES = new Set(['MX_CUSTOMS', 'US_CUSTOMS']);

const normalizeCode = (value) => (
    value == null ? null : String(value).trim().toUpperCase()
);

const guessStateFromStopCode = (stopCode) => {
    const state = normalizeCode(stopCode)?.slice(-2) || null;

    return US_STATE_CODES.has(state) ? state : null;
};

const getCrossesMarkedAsCross = async () => {
    const [rows] = await pool.query(`
        SELECT DISTINCT
            c.id,
            c.mcleod_order_id,
            c.po_number,
            c.mcleod_customer_id,
            c.trailer_id,
            c.cross_status_id,
            c.is_cross
        FROM crosses c
        WHERE c.is_cross = 1
        ORDER BY c.id
    `);

    return rows;
};

const getRealStops = async (crossId) => {
    const [rows] = await pool.query(`
        SELECT
            sequence,
            source,
            stop_code,
            stop_name,
            sched_arrive,
            actual_arrival,
            actual_departure
        FROM cross_stops
        WHERE cross_id = ?
        ORDER BY sequence
    `, [crossId]);

    return rows.filter((stop) => (
        !CUSTOMS_STOP_CODES.has(normalizeCode(stop.stop_code))
        && normalizeCode(stop.source) !== 'SYSTEM'
    ));
};

const hasCustomsStops = async (crossId) => {
    const [rows] = await pool.query(`
        SELECT COUNT(*) AS customs_count
        FROM cross_stops
        WHERE cross_id = ?
          AND stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
    `, [crossId]);

    return Number(rows[0]?.customs_count || 0) > 0;
};

const isUsOnlyBeforeTexas = (realStops = []) => {
    const firstTxIndex = realStops.findIndex((stop) => (
        guessStateFromStopCode(stop.stop_code) === 'TX'
    ));

    if (firstTxIndex <= 0) {
        return false;
    }

    const stopsBeforeTexas = realStops.slice(0, firstTxIndex);

    return stopsBeforeTexas.length > 0
        && stopsBeforeTexas.every((stop) => Boolean(guessStateFromStopCode(stop.stop_code)));
};

const main = async () => {
    const crosses = await getCrossesMarkedAsCross();
    const suspects = [];

    for (const cross of crosses) {
        const realStops = await getRealStops(cross.id);
        const hasCustoms = await hasCustomsStops(cross.id);

        if (!isUsOnlyBeforeTexas(realStops)) {
            continue;
        }

        suspects.push({
            ...cross,
            has_customs_stops: hasCustoms,
            real_stops: realStops.map((stop) => ({
                sequence: stop.sequence,
                stop_code: stop.stop_code,
                stop_name: stop.stop_name,
                state_guess: guessStateFromStopCode(stop.stop_code),
                sched_arrive: stop.sched_arrive,
                actual_arrival: stop.actual_arrival,
                actual_departure: stop.actual_departure,
            })),
        });
    }

    console.log(JSON.stringify({
        crossesChecked: crosses.length,
        suspects: suspects.length,
        suspectsWithCustoms: suspects.filter((suspect) => suspect.has_customs_stops).length,
        suspectsWithoutCustoms: suspects.filter((suspect) => !suspect.has_customs_stops).length,
        rows: suspects,
    }, null, 2));
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
