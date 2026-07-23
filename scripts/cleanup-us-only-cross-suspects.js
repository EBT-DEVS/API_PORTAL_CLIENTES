import pool, { closeDbPool } from '../src/config/db/db.portal.config.js';

const APPLY_CHANGES = process.argv.includes('--apply');
const STATUS_AVAILABLE = 1;
const STATUS_IN_PLANT = 2;
const STATUS_IN_TRANSIT_TO_CUSTOMER = 11;
const STATUS_COMPLETED = 12;

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

const hasValue = (value) => (
    value !== undefined && value !== null && value !== ''
);

const getCrossesMarkedAsCross = async () => {
    const [rows] = await pool.query(`
        SELECT
            id,
            mcleod_order_id,
            po_number,
            mcleod_customer_id,
            trailer_id,
            cross_status_id,
            is_cross
        FROM crosses
        WHERE is_cross = 1
        ORDER BY id
    `);

    return rows;
};

const getStops = async (connection, crossId) => {
    const [rows] = await connection.query(`
        SELECT
            id,
            cross_id,
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

    return rows;
};

const getRealStops = (stops = []) => (
    stops.filter((stop) => (
        !CUSTOMS_STOP_CODES.has(normalizeCode(stop.stop_code))
        && normalizeCode(stop.source) !== 'SYSTEM'
    ))
);

const getCustomsStops = (stops = []) => (
    stops.filter((stop) => CUSTOMS_STOP_CODES.has(normalizeCode(stop.stop_code)))
);

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

const deriveNonCrossStatusId = (realStops = []) => {
    const firstStop = realStops[0] || null;
    const lastStop = realStops[realStops.length - 1] || null;

    if (!firstStop || !hasValue(firstStop.actual_arrival)) {
        return STATUS_AVAILABLE;
    }

    if (!hasValue(firstStop.actual_departure)) {
        return STATUS_IN_PLANT;
    }

    if (lastStop && hasValue(lastStop.actual_departure)) {
        return STATUS_COMPLETED;
    }

    return STATUS_IN_TRANSIT_TO_CUSTOMER;
};

const getAssignmentReferences = async (connection, stopIds = []) => {
    if (!stopIds.length) {
        return [];
    }

    const placeholders = stopIds.map(() => '?').join(', ');
    const [rows] = await connection.query(`
        SELECT id, origin_stop_id, destination_stop_id
        FROM cross_assignments
        WHERE origin_stop_id IN (${placeholders})
           OR destination_stop_id IN (${placeholders})
    `, [...stopIds, ...stopIds]);

    return rows;
};

const findSuspects = async () => {
    const crosses = await getCrossesMarkedAsCross();
    const suspects = [];

    for (const cross of crosses) {
        const connection = await pool.getConnection();

        try {
            const stops = await getStops(connection, cross.id);
            const realStops = getRealStops(stops);

            if (!isUsOnlyBeforeTexas(realStops)) {
                continue;
            }

            const customsStops = getCustomsStops(stops);
            const assignmentReferences = await getAssignmentReferences(
                connection,
                customsStops.map((stop) => stop.id),
            );

            suspects.push({
                ...cross,
                customsStops,
                realStops,
                assignmentReferences,
                nextStatusId: deriveNonCrossStatusId(realStops),
            });
        } finally {
            connection.release();
        }
    }

    return suspects;
};

const cleanupSuspect = async (suspect) => {
    const connection = await pool.getConnection();
    const customsStopIds = suspect.customsStops.map((stop) => stop.id);
    const firstStop = suspect.realStops[0] || null;
    const lastStop = suspect.realStops[suspect.realStops.length - 1] || null;

    try {
        await connection.beginTransaction();

        if (suspect.assignmentReferences.length) {
            throw new Error(`cross ${suspect.id} tiene assignments apuntando a stops virtuales`);
        }

        if (customsStopIds.length) {
            const placeholders = customsStopIds.map(() => '?').join(', ');

            await connection.query(
                `DELETE FROM cross_customs WHERE cross_stop_id IN (${placeholders})`,
                customsStopIds,
            );
            await connection.query(
                `DELETE FROM cross_stops WHERE id IN (${placeholders})`,
                customsStopIds,
            );
        }

        for (const [index, stop] of suspect.realStops.entries()) {
            await connection.query(
                'UPDATE cross_stops SET sequence = ?, updated_at = NOW() WHERE id = ?',
                [index + 1, stop.id],
            );
        }

        await connection.query(`
            UPDATE crosses
            SET
                is_cross = 0,
                cross_status_id = ?,
                started_at = ?,
                completed_at = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [
            suspect.nextStatusId,
            firstStop?.actual_arrival || null,
            lastStop?.actual_departure || null,
            suspect.id,
        ]);

        await connection.commit();

        return {
            id: suspect.id,
            mcleod_order_id: suspect.mcleod_order_id,
            deletedCustomsStops: customsStopIds.length,
            resequencedRealStops: suspect.realStops.length,
            is_cross: 0,
            cross_status_id: suspect.nextStatusId,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const main = async () => {
    const suspects = await findSuspects();

    if (!APPLY_CHANGES) {
        console.log(JSON.stringify({
            mode: 'dry-run',
            suspects: suspects.length,
            suspectsWithCustoms: suspects.filter((suspect) => suspect.customsStops.length).length,
            suspectsWithoutCustoms: suspects.filter((suspect) => !suspect.customsStops.length).length,
            rows: suspects.map((suspect) => ({
                id: suspect.id,
                mcleod_order_id: suspect.mcleod_order_id,
                po_number: suspect.po_number,
                mcleod_customer_id: suspect.mcleod_customer_id,
                trailer_id: suspect.trailer_id,
                current_cross_status_id: suspect.cross_status_id,
                next_cross_status_id: suspect.nextStatusId,
                customs_stop_ids: suspect.customsStops.map((stop) => stop.id),
                assignment_references: suspect.assignmentReferences,
                real_stops: suspect.realStops.map((stop) => ({
                    id: stop.id,
                    sequence: stop.sequence,
                    stop_code: stop.stop_code,
                    stop_name: stop.stop_name,
                    state_guess: guessStateFromStopCode(stop.stop_code),
                })),
            })),
        }, null, 2));
        return;
    }

    const cleaned = [];

    for (const suspect of suspects) {
        cleaned.push(await cleanupSuspect(suspect));
    }

    console.log(JSON.stringify({
        mode: 'apply',
        cleaned: cleaned.length,
        rows: cleaned,
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
