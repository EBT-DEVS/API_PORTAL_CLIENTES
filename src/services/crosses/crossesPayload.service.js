import { getCrossStatusByCode } from '../../models/crosses/crosses.cat.statuses.model.js';
import { getCustomerGroupCustomers } from '../../models/groups/customer.group.customers.js';

const DEFAULT_CUSTOMER_GROUP_ID = 1;
const DEFAULT_PRIORITY_ID = 2;

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

const normalizeCode = (value) => (
    value == null ? null : String(value).trim().toUpperCase()
);

const normalizeArray = (value) => {

    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];

};

const hasValue = (value) => (
    value !== undefined && value !== null && value !== ''
);

const sortBySequence = (items = []) => (
    [...items].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
);

const getOrderId = (order) => firstValue(
    order?.id,
    order?.order_id,
    order?.mcleod_order_id,
    order?.order_number,
);

const getPoNumber = (order) => {

    const poNumber = firstValue(
        order?.blnum,
        order?.po_number,
        order?.poNumber,
    );

    return poNumber == null ? null : String(poNumber).trim() || null;

};

const getOrderMovements = (order) => normalizeArray(firstValue(
    order?.movement,
    order?.movements,
));

const getNumberOrNull = (value) => {

    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;

};

const buildCustomerGroupIdByCustomerCode = (customers = []) => (
    customers.reduce((map, customer) => {
        const customerCode = normalizeCode(customer.mcleod_customer_code);

        if (customerCode) {
            map.set(customerCode, customer.customer_group_id);
        }

        return map;
    }, new Map())
);

const getPayloadsByOrderId = (payloads = []) => (
    payloads.reduce((map, payload) => {
        if (payload.orderId) {
            map.set(String(payload.orderId), payload);
        }

        return map;
    }, new Map())
);

const findStopByCode = (stops, code) => (
    stops.find((stop) => normalizeCode(stop.stop_code) === code) || null
);

const hasCustomsStop = (stops = []) => (
    stops.some((stop) => ['MX_CUSTOMS', 'US_CUSTOMS'].includes(normalizeCode(stop.stop_code)))
);

const findFirstRealTxStop = (stops) => (
    stops.find((stop) => !stop._is_virtual && normalizeCode(stop._state) === 'TX') || null
);

const getPreloadedTrailerId = (order) => firstValue(
    order?.preload_trailer_id,
    order?.preloaded_trailer_id,
    order?.preloadTrailerId,
);

const getMovementTrailerId = (order) => (
    getOrderMovements(order)
        .map((movement) => firstValue(
            movement?.carrier_trailer,
            movement?.trailer_id,
            movement?.trailer,
        ))
        .find(hasValue) || null
);

const getAssignmentTrailerId = (assignments = []) => (
    assignments
        .map((assignment) => assignment?.trailer_id)
        .find(hasValue) || null
);

const resolveTrailerId = ({ order, assignments }) => {

    const preloadedTrailerId = getPreloadedTrailerId(order);

    if (preloadedTrailerId) {
        return {
            trailerId: preloadedTrailerId,
            trailerSource: 'order.preload_trailer_id',
        };
    }

    const movementTrailerId = getMovementTrailerId(order);

    if (movementTrailerId) {
        return {
            trailerId: movementTrailerId,
            trailerSource: 'movement.carrier_trailer',
        };
    }

    const assignmentTrailerId = getAssignmentTrailerId(assignments);

    if (assignmentTrailerId) {
        return {
            trailerId: assignmentTrailerId,
            trailerSource: 'assignments.trailer_id',
        };
    }

    return {
        trailerId: null,
        trailerSource: null,
    };

};

export const deriveCrossStatusCode = (stops = []) => {

    const sortedStops = sortBySequence(stops);
    const firstStop = sortedStops[0] || null;
    const lastStop = sortedStops[sortedStops.length - 1] || null;
    const mxCustoms = findStopByCode(sortedStops, 'MX_CUSTOMS');
    const usCustoms = findStopByCode(sortedStops, 'US_CUSTOMS');
    const firstTxStop = findFirstRealTxStop(sortedStops);

    if (!firstStop || !lastStop) {
        return {
            statusCode: 'AVAILABLE',
            reason: 'missing_stops',
        };
    }

    if (hasValue(lastStop.actual_departure)) {
        return {
            statusCode: 'COMPLETED',
            reason: 'last_stop_departed',
        };
    }

    if (!hasValue(firstStop.actual_arrival)) {
        return {
            statusCode: 'AVAILABLE',
            reason: 'first_stop_not_arrived',
        };
    }

    if (!hasValue(firstStop.actual_departure)) {
        return {
            statusCode: 'IN_PLANT',
            reason: 'first_stop_arrived_not_departed',
        };
    }

    if (!mxCustoms && !usCustoms) {
        return {
            statusCode: 'IN_TRANSIT_TO_CUSTOMER',
            reason: 'non_cross_after_first_stop_departure',
        };
    }

    if (mxCustoms && !hasValue(mxCustoms.actual_arrival)) {
        return {
            statusCode: 'IN_TRANSIT_TO_BORDER',
            reason: 'origin_departed_before_mx_customs_arrival',
        };
    }

    if (mxCustoms && !hasValue(mxCustoms.actual_departure)) {
        return {
            statusCode: 'AT_MX_CUSTOMS',
            reason: 'mx_customs_arrived_not_departed',
        };
    }

    if (usCustoms && !hasValue(usCustoms.actual_arrival)) {
        return {
            statusCode: 'CROSSING',
            reason: 'mx_customs_departed_before_us_customs_arrival',
        };
    }

    if (usCustoms && !hasValue(usCustoms.actual_departure)) {
        return {
            statusCode: 'AT_US_CUSTOMS',
            reason: 'us_customs_arrived_not_departed',
        };
    }

    if (firstTxStop && !hasValue(firstTxStop.actual_arrival)) {
        return {
            statusCode: 'IN_TRANSIT_TO_US_YARD',
            reason: 'us_customs_departed_before_first_tx_stop_arrival',
        };
    }

    if (firstTxStop && firstTxStop !== lastStop && !hasValue(firstTxStop.actual_departure)) {
        return {
            statusCode: 'AT_US_YARD',
            reason: 'first_tx_stop_arrived_not_departed',
        };
    }

    return {
        statusCode: 'IN_TRANSIT_TO_CUSTOMER',
        reason: 'after_us_customs_before_last_stop_departure',
    };

};

export const buildCrossPayloadFromOrder = async ({
    order,
    stopsPayload = null,
    assignmentPayload = null,
    customerGroupIdByCustomerCode,
    priorityId = DEFAULT_PRIORITY_ID,
} = {}) => {

    const orderId = getOrderId(order);
    const stops = sortBySequence(stopsPayload?.stops || []);
    const assignments = assignmentPayload?.assignments || [];
    const firstStop = stops[0] || null;
    const lastStop = stops[stops.length - 1] || null;
    const customerCode = normalizeCode(order?.customer_id);
    const customerGroupId = customerGroupIdByCustomerCode.get(customerCode) || DEFAULT_CUSTOMER_GROUP_ID;
    const statusResolution = deriveCrossStatusCode(stops);
    const status = await getCrossStatusByCode(statusResolution.statusCode);
    const { trailerId, trailerSource } = resolveTrailerId({
        order,
        assignments,
    });

    return {
        isValid: Boolean(orderId && status?.id),
        cross: {
            customer_group_id: customerGroupId,
            cross_status_id: status?.id || null,
            priority_id: priorityId,
            mcleod_order_id: orderId,
            po_number: getPoNumber(order),
            mcleod_customer_id: customerCode,
            trailer_id: trailerId,
            min_temperature: getNumberOrNull(firstValue(order?.temperature_min, order?.temp_min)),
            max_temperature: getNumberOrNull(firstValue(order?.temperature_max, order?.temp_max)),
            started_at: firstStop?.actual_arrival || null,
            completed_at: lastStop?.actual_departure || null,
            is_cross: hasCustomsStop(stops) ? 1 : 0,
        },
        _mcleod_order_id: orderId,
        _missingFields: {
            status: status ? null : statusResolution.statusCode,
            trailer_id: trailerId ? null : 'missing_trailer_id',
            stops: stops.length ? null : 'missing_stops_payload',
        },
        _statusResolution: {
            ...statusResolution,
            statusId: status?.id || null,
            statusName: status?.name || null,
        },
        _trailerResolution: {
            trailerId,
            trailerSource,
        },
        _customerResolution: {
            customerCode,
            customerGroupId,
        },
        _source: {
            stopsCount: stops.length,
            assignmentsCount: assignments.length,
        },
    };

};

export const buildCrossPayloadsFromOrders = async ({
    orders = [],
    stopsPayloads = [],
    assignmentPayloads = [],
    priorityId = DEFAULT_PRIORITY_ID,
    isActive = 1,
} = {}) => {

    const customers = await getCustomerGroupCustomers(isActive);
    const customerGroupIdByCustomerCode = buildCustomerGroupIdByCustomerCode(customers);
    const stopsByOrderId = getPayloadsByOrderId(stopsPayloads);
    const assignmentsByOrderId = getPayloadsByOrderId(assignmentPayloads);
    const payloads = [];

    for (const order of orders) {
        const orderId = getOrderId(order);

        payloads.push(await buildCrossPayloadFromOrder({
            order,
            stopsPayload: stopsByOrderId.get(String(orderId)),
            assignmentPayload: assignmentsByOrderId.get(String(orderId)),
            customerGroupIdByCustomerCode,
            priorityId,
        }));
    }

    const invalidPayloads = payloads.filter((payload) => !payload.isValid);
    const statusSummary = payloads.reduce((summary, payload) => {
        const statusCode = payload._statusResolution.statusCode;
        summary[statusCode] = (summary[statusCode] || 0) + 1;
        return summary;
    }, {});

    return {
        ordersCount: orders.length,
        crossesCount: payloads.length,
        validCrossesCount: payloads.length - invalidPayloads.length,
        invalidCrossesCount: invalidPayloads.length,
        priorityId,
        statusSummary,
        payloads,
        invalidPayloads,
    };

};
