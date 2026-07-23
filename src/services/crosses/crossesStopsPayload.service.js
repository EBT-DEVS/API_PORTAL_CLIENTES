import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compactDateTimePattern = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:[+-]\d{4})?$/;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const virtualCrossStopsPath = path.resolve(__dirname, '../../catalogs/crosses/virtual-cross-stops.json');
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

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

const normalizeArray = (value) => {

    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];

};

const normalizeCode = (value) => (
    value == null ? null : String(value).trim().toUpperCase()
);

const normalizeDateTime = (value) => {

    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const rawValue = String(value).trim();
    const compactMatch = rawValue.match(compactDateTimePattern);

    if (compactMatch) {
        const [, year, month, day, hour, minute, second] = compactMatch;
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    const isoMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);

    if (isoMatch) {
        return `${isoMatch[1]} ${isoMatch[2]}`;
    }

    return rawValue;

};

const toNumberOrNull = (value) => {

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;

};

const getOrderId = (order) => firstValue(
    order?.id,
    order?.order_id,
    order?.mcleod_order_id,
    order?.order_number,
);

const getOrderStops = (order) => normalizeArray(order?.stops);

const getStopId = (stop) => firstValue(stop?.id, stop?.stop_id);

const getStopSequence = (stop, fallbackSequence) => Number(firstValue(
    stop?.order_sequence,
    stop?.sequence,
    stop?.movement_sequence,
    fallbackSequence,
));

const resolveArrivalStatus = ({ schedArrive, actualArrival }) => {

    if (!actualArrival) {
        return schedArrive ? 'PENDING' : 'UNKNOWN';
    }

    if (!schedArrive) {
        return 'UNKNOWN';
    }

    const scheduledDate = new Date(String(schedArrive).replace(' ', 'T'));
    const arrivalDate = new Date(String(actualArrival).replace(' ', 'T'));

    if (Number.isNaN(scheduledDate.getTime()) || Number.isNaN(arrivalDate.getTime())) {
        return 'UNKNOWN';
    }

    return arrivalDate.getTime() <= scheduledDate.getTime() ? 'ON_TIME' : 'LATE';

};

const getStopCompactKey = (stop) => (
    normalizeCode(stop?.stop_code) || normalizeCode(stop?.stop_name) || null
);

const resequenceStops = (stops = []) => (
    stops.map((stop, index) => ({
        ...stop,
        sequence: index + 1,
    }))
);

const isUsState = (state) => (
    US_STATE_CODES.has(normalizeCode(state))
);

const hasInternationalStopBeforeIndex = (stops = [], stopIndex) => (
    stops
        .slice(0, stopIndex)
        .some((stop) => {
            const state = normalizeCode(stop?._state);

            return state && !isUsState(state);
        })
);

const compactConsecutiveDuplicateStops = (stops = []) => {

    const compactedStops = [];
    let compactedCount = 0;

    for (const stop of stops) {
        const previousStop = compactedStops[compactedStops.length - 1] || null;
        const stopKey = getStopCompactKey(stop);
        const previousStopKey = getStopCompactKey(previousStop);

        if (stopKey && previousStopKey && stopKey === previousStopKey) {
            const mergedMcleodStopIds = [
                ...(previousStop._merged_mcleod_stop_ids || [previousStop._mcleod_stop_id].filter(Boolean)),
                stop._mcleod_stop_id,
                ...(stop._merged_mcleod_stop_ids || []),
            ].filter(Boolean);

            compactedStops[compactedStops.length - 1] = {
                ...previousStop,
                actual_departure: stop.actual_departure,
                is_completed: stop.actual_departure ? 1 : 0,
                arrival_status: resolveArrivalStatus({
                    schedArrive: previousStop.sched_arrive,
                    actualArrival: previousStop.actual_arrival,
                }),
                _merged_mcleod_stop_ids: [...new Set(mergedMcleodStopIds)],
                _compacted_duplicates_count: Number(previousStop._compacted_duplicates_count || 0) + 1,
                _last_compacted_mcleod_stop_id: stop._mcleod_stop_id || previousStop._last_compacted_mcleod_stop_id || null,
            };
            compactedCount += 1;
            continue;
        }

        compactedStops.push({
            ...stop,
            _merged_mcleod_stop_ids: [stop._mcleod_stop_id].filter(Boolean),
            _compacted_duplicates_count: 0,
        });
    }

    return {
        stops: resequenceStops(compactedStops),
        compactedCount,
    };

};

const buildCrossStopPayload = ({ stop, sequence, order }) => {

    const schedArrive = normalizeDateTime(firstValue(
        stop?.sched_arrive_early,
        stop?.sched_arrive_late,
        stop?.scheduled_arrival,
    ));
    const actualArrival = normalizeDateTime(firstValue(
        stop?.actual_arrival,
        stop?.actual_arrive,
        stop?.arrival_at,
    ));
    const actualDeparture = normalizeDateTime(firstValue(
        stop?.actual_departure,
        stop?.departure_at,
    ));

    return {
        cross_id: null,
        sequence,
        source: 'MCLEOD',
        stop_code: normalizeCode(stop?.location_id),
        stop_name: firstValue(stop?.location_name, stop?.name),
        latitude: toNumberOrNull(stop?.latitude),
        longitude: toNumberOrNull(stop?.longitude),
        eta: normalizeDateTime(stop?.eta),
        sched_arrive: schedArrive,
        actual_arrival: actualArrival,
        actual_departure: actualDeparture,
        arrival_status: resolveArrivalStatus({
            schedArrive,
            actualArrival,
        }),
        is_completed: actualDeparture ? 1 : 0,
        _mcleod_order_id: getOrderId(order),
        _mcleod_stop_id: getStopId(stop),
        _stop_type: stop?.stop_type || null,
        _movement_id: stop?.movement_id || null,
        _state: stop?.state || null,
    };

};

const buildVirtualCrossStopPayload = ({ virtualStop, sequence, order }) => ({
    cross_id: null,
    sequence,
    source: virtualStop.source || 'SYSTEM',
    stop_code: normalizeCode(virtualStop.stop_code),
    stop_name: virtualStop.stop_name,
    latitude: toNumberOrNull(virtualStop.latitude),
    longitude: toNumberOrNull(virtualStop.longitude),
    eta: normalizeDateTime(virtualStop.eta),
    sched_arrive: normalizeDateTime(virtualStop.sched_arrive),
    actual_arrival: null,
    actual_departure: null,
    arrival_status: virtualStop.arrival_status || 'PENDING',
    is_completed: 0,
    _mcleod_order_id: getOrderId(order),
    _mcleod_stop_id: null,
    _stop_type: virtualStop.virtual_type || virtualStop.code || null,
    _movement_id: null,
    _state: null,
    _is_virtual: true,
});

const loadVirtualCrossStops = async () => {

    const rawCatalog = await fs.readFile(virtualCrossStopsPath, 'utf8');
    const virtualStops = JSON.parse(rawCatalog);

    if (!Array.isArray(virtualStops)) {
        throw new Error('virtual-cross-stops.json debe contener un array');
    }

    return virtualStops;

};

const addVirtualCrossStops = ({ stops, order, virtualStops }) => {

    if (!virtualStops.length || !stops.length) {
        return stops.map((stop, index) => ({
            ...stop,
            sequence: index + 1,
        }));
    }

    const txStopIndex = stops.findIndex((stop) => (
        normalizeCode(stop._state) === 'TX'
    ));

    if (txStopIndex === 0) {
        return resequenceStops(stops);
    }

    if (txStopIndex < 0 || !hasInternationalStopBeforeIndex(stops, txStopIndex)) {
        return resequenceStops(stops);
    }

    const insertIndex = txStopIndex;
    const virtualStopPayloads = virtualStops.map((virtualStop, index) => buildVirtualCrossStopPayload({
        virtualStop,
        sequence: insertIndex + index + 1,
        order,
    }));
    const mergedStops = [
        ...stops.slice(0, insertIndex),
        ...virtualStopPayloads,
        ...stops.slice(insertIndex),
    ];

    return resequenceStops(mergedStops);

};

export const buildCrossStopsPayloadFromOrder = async ({ order, company = 'ebt' }) => {

    const virtualStops = await loadVirtualCrossStops();
    const originalStops = getOrderStops(order);
    const requiredStopIds = originalStops
        .map((stop) => getStopId(stop))
        .filter(Boolean)
        .map(String);
    const mcleodStops = originalStops
        .map((stop, index) => ({
            stop,
            fallbackSequence: index + 1,
        }))
        .sort((a, b) => {
            const sequenceA = getStopSequence(a.stop, a.fallbackSequence);
            const sequenceB = getStopSequence(b.stop, b.fallbackSequence);
            return sequenceA - sequenceB;
        })
        .map(({ stop }, index) => buildCrossStopPayload({
            stop,
            sequence: index + 1,
            order,
        }));
    const compactedMcleodStops = compactConsecutiveDuplicateStops(mcleodStops);
    const stops = addVirtualCrossStops({
        stops: compactedMcleodStops.stops,
        order,
        virtualStops,
    });

    return {
        orderId: getOrderId(order),
        customerId: order?.customer_id || null,
        requiredStopIds,
        originalStopsCount: originalStops.length,
        missingStopIds: [],
        hydratedStopIds: [],
        virtualStopCodes: virtualStops.map((stop) => stop.stop_code || stop.code).filter(Boolean),
        compactedStopsCount: compactedMcleodStops.compactedCount,
        failedStopIds: [],
        isComplete: true,
        stops,
    };

};

export const buildCrossStopsPayloadsFromOrders = async ({ orders = [], company = 'ebt' } = {}) => {

    const payloads = [];

    for (const order of orders) {
        payloads.push(await buildCrossStopsPayloadFromOrder({
            order,
            company,
        }));
    }

    const incompletePayloads = payloads.filter((payload) => !payload.isComplete);

    return {
        ordersCount: orders.length,
        completeOrdersCount: payloads.length - incompletePayloads.length,
        incompleteOrdersCount: incompletePayloads.length,
        totalStopsCount: payloads.reduce((total, payload) => total + payload.stops.length, 0),
        payloads,
        incompletePayloads,
    };

};
