import env from '../../config/env/env.config.js';
import { getActiveCrossesForUpdate, getCrossDetailById } from '../../models/crosses/crosses.model.js';
import { buildCrossAssignmentsPayloadsFromOrders } from './crossesAssignmentsPayload.service.js';
import { fetchOrderById } from './crossesMcleodOrders.service.js';
import { buildCrossPayloadsFromOrders } from './crossesPayload.service.js';
import { buildCrossStopsPayloadsFromOrders } from './crossesStopsPayload.service.js';
import { persistActiveCrossesUpdate } from './crossesUpdatePersistence.service.js';

const VIRTUAL_STOP_CODES = new Set(['MX_CUSTOMS', 'US_CUSTOMS']);
const CANCELED_CROSS_STATUS_ID = 13;

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

const normalizeCode = (value) => (
    value == null ? null : String(value).trim().toUpperCase()
);

const toKey = (value) => (
    value == null ? null : String(value)
);

const getOrderId = (order) => firstValue(
    order?.id,
    order?.order_id,
    order?.mcleod_order_id,
    order?.order_number,
);

const getOrderStatus = (order) => normalizeCode(firstValue(
    order?.status,
    order?.order_status,
    order?.status_id,
));

const getActiveOrderId = (cross) => firstValue(
    cross?.mcleod_order_id,
    cross?.order_id,
    cross?.orders_id,
);

const uniqueByOrderId = (crosses = []) => {

    const seen = new Set();
    const unique = [];

    for (const cross of crosses) {
        const orderId = toKey(getActiveOrderId(cross));

        if (!orderId || seen.has(orderId)) {
            continue;
        }

        seen.add(orderId);
        unique.push({
            ...cross,
            mcleod_order_id: orderId,
        });
    }

    return unique;

};

const buildActiveCrossByOrderId = (crosses = []) => (
    crosses.reduce((map, cross) => {
        const orderId = toKey(getActiveOrderId(cross));

        if (orderId) {
            map.set(orderId, cross);
        }

        return map;
    }, new Map())
);

const buildPayloadsByOrderId = (payloads = []) => (
    payloads.reduce((map, payload) => {
        const orderId = toKey(payload?.orderId || payload?._mcleod_order_id);

        if (orderId) {
            map.set(orderId, payload);
        }

        return map;
    }, new Map())
);

const buildDbVirtualStopsByCode = (stops = []) => (
    stops.reduce((map, stop) => {
        const stopCode = normalizeCode(stop?.stop_code || stop?.code);

        if (VIRTUAL_STOP_CODES.has(stopCode)) {
            map.set(stopCode, stop);
        }

        return map;
    }, new Map())
);

const mergeDbVirtualStopTimes = ({ payload, dbStops = [] }) => {

    const dbVirtualStopsByCode = buildDbVirtualStopsByCode(dbStops);

    if (!payload?.stops?.length || !dbVirtualStopsByCode.size) {
        return payload;
    }

    return {
        ...payload,
        stops: payload.stops.map((stop) => {
            const stopCode = normalizeCode(stop?.stop_code);
            const dbStop = dbVirtualStopsByCode.get(stopCode);

            if (!dbStop || !VIRTUAL_STOP_CODES.has(stopCode)) {
                return stop;
            }

            return {
                ...stop,
                actual_arrival: firstValue(stop.actual_arrival, dbStop.actual_arrival),
                actual_departure: firstValue(stop.actual_departure, dbStop.actual_departure),
                is_completed: firstValue(stop.is_completed, dbStop.is_completed, 0),
                _cross_stop_id: dbStop.id || dbStop.cross_stop_id || null,
                _merged_from_db: true,
            };
        }),
    };

};

const fetchActiveOrderFromMcleod = async ({ activeCross, company }) => {

    const orderId = getActiveOrderId(activeCross);
    const result = await fetchOrderById({
        orderId,
        company,
    });
    const order = (result.orders || [])
        .find((item) => toKey(getOrderId(item)) === toKey(orderId))
        || result.orders?.[0]
        || null;

    return {
        activeCross,
        orderId,
        query: result.query,
        fetchedOrders: result.fetchedOrders,
        order,
    };

};

const applyCanceledStatusFromOrder = ({ order, crossPayload }) => {

    if (!crossPayload?.cross || getOrderStatus(order) !== 'V') {
        return crossPayload;
    }

    return {
        ...crossPayload,
        cross: {
            ...crossPayload.cross,
            cross_status_id: CANCELED_CROSS_STATUS_ID,
            completed_at: crossPayload.cross.completed_at || null,
        },
        _statusResolution: {
            ...(crossPayload._statusResolution || {}),
            statusCode: 'CANCELED',
            statusId: CANCELED_CROSS_STATUS_ID,
            reason: 'mcleod_order_status_v',
        },
    };

};

export const buildActiveCrossesUpdatePayloads = async ({
    company = env.cron.crossings.company || 'ebt',
    isActive = 1,
    refetchAssignments = true,
    priorityId = 2,
} = {}) => {

    const activeCrosses = uniqueByOrderId(await getActiveCrossesForUpdate());
    const activeCrossByOrderId = buildActiveCrossByOrderId(activeCrosses);
    const fetchedResults = [];
    const skippedOrders = [];

    for (const activeCross of activeCrosses) {
        try {
            const result = await fetchActiveOrderFromMcleod({
                activeCross,
                company,
            });

            fetchedResults.push(result);

            if (!result.order) {
                skippedOrders.push({
                    orderId: result.orderId,
                    reason: 'mcleod_order_not_found',
                    query: result.query,
                });
            }
        } catch (error) {
            skippedOrders.push({
                orderId: getActiveOrderId(activeCross),
                reason: error.message,
            });
        }
    }

    const orders = fetchedResults
        .map((result) => result.order)
        .filter(Boolean);
    const detailResults = await Promise.all(
        orders.map(async (order) => {
            const orderId = toKey(getOrderId(order));
            const activeCross = activeCrossByOrderId.get(orderId);

            if (!activeCross?.id) {
                return {
                    orderId,
                    detail: null,
                };
            }

            return {
                orderId,
                detail: await getCrossDetailById(activeCross.id),
            };
        })
    );
    const detailByOrderId = detailResults.reduce((map, result) => {
        map.set(result.orderId, result.detail);
        return map;
    }, new Map());
    const stopsResult = await buildCrossStopsPayloadsFromOrders({
        orders,
        company,
    });
    const mergedStopsPayloads = (stopsResult.payloads || []).map((payload) => {
        const orderId = toKey(payload.orderId);
        const detail = detailByOrderId.get(orderId);

        return mergeDbVirtualStopTimes({
            payload,
            dbStops: detail?.stops || [],
        });
    });
    const assignmentsResult = await buildCrossAssignmentsPayloadsFromOrders({
        orders,
        company,
        refetchAssignments,
    });
    const crossesResult = await buildCrossPayloadsFromOrders({
        orders,
        stopsPayloads: mergedStopsPayloads,
        assignmentPayloads: assignmentsResult.payloads || [],
        priorityId,
        isActive,
    });
    const stopsByOrderId = buildPayloadsByOrderId(mergedStopsPayloads);
    const assignmentsByOrderId = buildPayloadsByOrderId(assignmentsResult.payloads || []);
    const crossesByOrderId = buildPayloadsByOrderId(crossesResult.payloads || []);
    const payloads = orders.map((order) => {
        const orderId = toKey(getOrderId(order));
        const activeCross = activeCrossByOrderId.get(orderId);

        return {
            orderId,
            crossId: activeCross?.id || null,
            activeCross,
            order,
            crossPayload: applyCanceledStatusFromOrder({
                order,
                crossPayload: crossesByOrderId.get(orderId) || null,
            }),
            stopsPayload: stopsByOrderId.get(orderId) || null,
            assignmentPayload: assignmentsByOrderId.get(orderId) || null,
            dbDetail: detailByOrderId.get(orderId) || null,
        };
    });
    const persistenceResult = await persistActiveCrossesUpdate({
        items: payloads,
    });

    return {
        ok: true,
        company,
        isActive,
        refetchAssignments,
        priorityId,
        activeCrossesCount: activeCrosses.length,
        fetchedOrdersCount: fetchedResults.reduce((total, result) => total + result.fetchedOrders, 0),
        matchedOrdersCount: orders.length,
        skippedOrdersCount: skippedOrders.length,
        skippedOrders,
        payloads: {
            stopsCount: mergedStopsPayloads.reduce((total, payload) => total + (payload.stops?.length || 0), 0),
            completeOrdersCount: stopsResult.completeOrdersCount,
            incompleteOrdersCount: stopsResult.incompleteOrdersCount,
            assignmentsCount: assignmentsResult.assignmentsCount,
            skippedAssignmentsCount: assignmentsResult.skippedAssignmentsCount,
            crossesCount: crossesResult.crossesCount,
            validCrossesCount: crossesResult.validCrossesCount,
            invalidCrossesCount: crossesResult.invalidCrossesCount,
            statusSummary: crossesResult.statusSummary,
            items: payloads,
        },
        persistence: persistenceResult,
    };

};
