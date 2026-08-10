import { insertCrossAssignmentIgnore } from '../../models/crosses/crosses.assignments.model.js';
import { insertCrossIgnore } from '../../models/crosses/crosses.model.js';
import { insertCrossStopIgnore } from '../../models/crosses/crosses.stops.model.js';
import { getTrailerData } from '../../models/db_gps/trailers.model.js';
import { enrichActiveStopEtaFromPcMiller } from './crossesPcMillerEta.service.js';

const getOrderId = (payload) => (
    payload?._mcleod_order_id
    || payload?.cross?.mcleod_order_id
    || payload?.orderId
    || null
);

const toKey = (value) => (
    value == null ? null : String(value)
);

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

const getPayloadsByOrderId = (payloads = []) => (
    payloads.reduce((map, payload) => {
        const orderId = toKey(getOrderId(payload));

        if (orderId) {
            map.set(orderId, payload);
        }

        return map;
    }, new Map())
);

const findInsertedStopId = ({ stop, insertedStopsByMcleodStopId, insertedStopsBySequence }) => {

    const mcleodStopId = toKey(stop?._mcleod_stop_id);

    if (mcleodStopId && insertedStopsByMcleodStopId.has(mcleodStopId)) {
        return insertedStopsByMcleodStopId.get(mcleodStopId).id;
    }

    const sequence = toKey(stop?.sequence);

    if (sequence && insertedStopsBySequence.has(sequence)) {
        return insertedStopsBySequence.get(sequence).id;
    }

    return null;

};

const insertStopsForCross = async ({ cross, orderId, stops = [] }) => {

    const insertedStops = [];
    const skippedStops = [];
    const insertedStopsBySequence = new Map();
    const insertedStopsByMcleodStopId = new Map();

    for (const stop of stops) {
        try {
            const insertedStop = await insertCrossStopIgnore({
                ...stop,
                cross_id: cross.id,
                mcleod_order_id: orderId,
            });

            if (!insertedStop?.id) {
                skippedStops.push({
                    stop,
                    reason: 'sp_returned_no_stop',
                });
                continue;
            }

            insertedStops.push(insertedStop);
            insertedStopsBySequence.set(toKey(stop.sequence), insertedStop);

            for (const mcleodStopId of [
                stop._mcleod_stop_id,
                ...(stop._merged_mcleod_stop_ids || []),
            ]) {
                if (mcleodStopId) {
                    insertedStopsByMcleodStopId.set(toKey(mcleodStopId), insertedStop);
                }
            }
        } catch (error) {
            skippedStops.push({
                stop,
                reason: error.message,
            });
        }
    }

    return {
        insertedStops,
        skippedStops,
        insertedStopsBySequence,
        insertedStopsByMcleodStopId,
    };

};

const insertAssignmentsForCross = async ({
    cross,
    orderId,
    assignments = [],
    insertedStopsBySequence,
    insertedStopsByMcleodStopId,
}) => {

    const insertedAssignments = [];
    const skippedAssignments = [];

    for (const assignment of assignments) {
        const originStop = {
            _mcleod_stop_id: assignment._origin_mcleod_stop_id,
        };
        const destinationStop = {
            _mcleod_stop_id: assignment._destination_mcleod_stop_id,
        };
        const originStopId = findInsertedStopId({
            stop: originStop,
            insertedStopsByMcleodStopId,
            insertedStopsBySequence,
        });
        const destinationStopId = findInsertedStopId({
            stop: destinationStop,
            insertedStopsByMcleodStopId,
            insertedStopsBySequence,
        });

        if (!originStopId || !destinationStopId) {
            skippedAssignments.push({
                assignment,
                reason: 'missing_origin_or_destination_stop_id',
            });
            continue;
        }

        try {
            const insertedAssignment = await insertCrossAssignmentIgnore({
                ...assignment,
                cross_id: cross.id,
                mcleod_order_id: orderId,
                origin_stop_id: originStopId,
                destination_stop_id: destinationStopId,
            });

            if (!insertedAssignment?.id) {
                skippedAssignments.push({
                    assignment,
                    reason: 'sp_returned_no_assignment',
                });
                continue;
            }

            insertedAssignments.push(insertedAssignment);
        } catch (error) {
            skippedAssignments.push({
                assignment,
                reason: error.message,
            });
        }
    }

    return {
        insertedAssignments,
        skippedAssignments,
    };

};

const enrichStopsEta = async ({ stops = [], gps = null } = {}) => {

    try {
        return await enrichActiveStopEtaFromPcMiller({
            stops,
            gps,
        });
    } catch (error) {
        return {
            stops: stops.map((stop) => ({
                ...stop,
                eta: null,
            })),
            activeStopEta: null,
            skippedReason: error.message,
        };
    }

};

const getGpsForTrailer = async (trailerId) => {

    if (!trailerId) {
        return null;
    }

    return getTrailerData(trailerId);

};

export const persistInitialCrosses = async ({
    crossPayloads = [],
    stopsPayloads = [],
    assignmentPayloads = [],
} = {}) => {

    const stopsPayloadsByOrderId = getPayloadsByOrderId(stopsPayloads);
    const assignmentPayloadsByOrderId = getPayloadsByOrderId(assignmentPayloads);
    const results = [];
    const skippedCrosses = [];

    for (const crossPayload of crossPayloads) {
        const orderId = toKey(getOrderId(crossPayload));

        if (!orderId || !crossPayload?.isValid || !crossPayload?.cross) {
            skippedCrosses.push({
                orderId,
                reason: 'invalid_cross_payload',
                payload: crossPayload,
            });
            continue;
        }

        try {
            const cross = await insertCrossIgnore(crossPayload.cross);

            if (!cross?.id) {
                skippedCrosses.push({
                    orderId,
                    reason: 'sp_returned_no_cross',
                    payload: crossPayload,
                });
                continue;
            }

            const stopsPayload = stopsPayloadsByOrderId.get(orderId) || { stops: [] };
            const assignmentPayload = assignmentPayloadsByOrderId.get(orderId) || { assignments: [] };
            const gps = await getGpsForTrailer(firstValue(
                crossPayload.cross.trailer_id,
                cross.trailer_id,
                cross.caja,
            ));
            const stopsEtaResult = await enrichStopsEta({
                stops: stopsPayload.stops || [],
                gps,
            });
            const stopsResult = await insertStopsForCross({
                cross,
                orderId,
                stops: stopsEtaResult.stops || [],
            });
            const assignmentsResult = await insertAssignmentsForCross({
                cross,
                orderId,
                assignments: assignmentPayload.assignments || [],
                insertedStopsBySequence: stopsResult.insertedStopsBySequence,
                insertedStopsByMcleodStopId: stopsResult.insertedStopsByMcleodStopId,
            });

            results.push({
                orderId,
                cross,
                stopsCount: stopsResult.insertedStops.length,
                skippedStopsCount: stopsResult.skippedStops.length,
                assignmentsCount: assignmentsResult.insertedAssignments.length,
                skippedAssignmentsCount: assignmentsResult.skippedAssignments.length,
                activeStopEta: stopsEtaResult.activeStopEta,
                skippedActiveStopEtaReason: stopsEtaResult.skippedReason,
                skippedStops: stopsResult.skippedStops,
                skippedAssignments: assignmentsResult.skippedAssignments,
            });
        } catch (error) {
            skippedCrosses.push({
                orderId,
                reason: error.message,
                payload: crossPayload,
            });
        }
    }

    return {
        crossesCount: crossPayloads.length,
        persistedCrossesCount: results.length,
        skippedCrossesCount: skippedCrosses.length,
        persistedStopsCount: results.reduce((total, result) => total + result.stopsCount, 0),
        skippedStopsCount: results.reduce((total, result) => total + result.skippedStopsCount, 0),
        activeStopEtasCount: results.filter((result) => result.activeStopEta).length,
        skippedActiveStopEtasCount: results.filter((result) => result.skippedActiveStopEtaReason).length,
        persistedAssignmentsCount: results.reduce((total, result) => total + result.assignmentsCount, 0),
        skippedAssignmentsCount: results.reduce((total, result) => total + result.skippedAssignmentsCount, 0),
        results,
        skippedCrosses,
    };

};
