import { upsertCurrentCrossAssignment } from '../../models/crosses/crosses.assignments.model.js';
import { getCrossDetailById, updateCrossFromMcleod } from '../../models/crosses/crosses.model.js';
import { deleteUnreferencedCrossStopsAfterSequence, updateCrossSpecialStopGeofenceTimes, upsertCrossStopSync } from '../../models/crosses/crosses.stops.model.js';
import { getTrailerData } from '../../models/db_gps/trailers.model.js';
import { getTkGeofenceEvents } from '../../models/db_gps/tk.events.model.js';
import { enrichActiveStopEtaFromPcMiller } from './crossesPcMillerEta.service.js';

const toKey = (value) => (
    value == null ? null : String(value)
);

const normalizeCode = (value) => (
    value == null ? null : String(value).trim().toUpperCase()
);

const CUSTOMS_STOP_CODES = new Set(['MX_CUSTOMS', 'US_CUSTOMS']);
const GEOFENCE_EVENT_STOP_CODES = new Set(['MX_CUSTOMS', 'US_CUSTOMS', 'EBT_YARD']);
const SPECIAL_GEOFENCE_STOP_CODES = new Set(['PENSIEBT', 'MX_CUSTOMS', 'US_CUSTOMS', 'EBT_YARD']);
const INFERRED_FROM_GEOFENCE_SOURCE = 'GPS_GEOFENCE';
const SPECIAL_GEOFENCES_BY_STOP_CODE = {
    MX_CUSTOMS: [
        'Aduana 240, Mex',
        'ADUANA MEXICANA COLOMBIA',
    ],
    US_CUSTOMS: [
        'Aduana Americana 240',
        'Aduana Americana Colombia Exportacion',
    ],
    EBT_YARD: [
        'EBT Torre',
    ],
};

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

const buildDbStopsBySequence = (stops = []) => (
    stops.reduce((map, stop) => {
        const sequence = toKey(stop?.sequence);

        if (sequence) {
            map.set(sequence, stop);
        }

        return map;
    }, new Map())
);

const hasValue = (value) => (
    value !== undefined && value !== null && value !== ''
);

const toSqlDateTime = (timestamp) => {

    if (!Number.isFinite(timestamp)) {
        return null;
    }

    const date = new Date(timestamp);
    const pad = (value) => String(value).padStart(2, '0');

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join('-') + ' ' + [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join(':');

};

const toUtcSqlDateTime = (value = new Date()) => {

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const pad = (part) => String(part).padStart(2, '0');

    return [
        date.getUTCFullYear(),
        pad(date.getUTCMonth() + 1),
        pad(date.getUTCDate()),
    ].join('-') + ' ' + [
        pad(date.getUTCHours()),
        pad(date.getUTCMinutes()),
        pad(date.getUTCSeconds()),
    ].join(':');

};

const toUtcStoredDateOrNull = (value) => {

    if (!hasValue(value)) {
        return null;
    }

    if (value instanceof Date) {
        return new Date(Date.UTC(
            value.getFullYear(),
            value.getMonth(),
            value.getDate(),
            value.getHours(),
            value.getMinutes(),
            value.getSeconds(),
        ));
    }

    const match = String(value).trim().match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
    );

    if (!match) {
        return null;
    }

    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    const date = new Date(Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
    ));

    return Number.isNaN(date.getTime()) ? null : date;

};

const toLocalSqlDateTime = (value) => {

    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return toSqlDateTime(date.getTime());

};

const buildCurrentLocalDayUtcWindow = () => {

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return {
        start: toUtcSqlDateTime(start),
        end: toUtcSqlDateTime(end),
    };

};

const resolveSpecialGeofenceStopCode = (stop) => {

    const stopCode = normalizeCode(stop?.stop_code);

    if (SPECIAL_GEOFENCE_STOP_CODES.has(stopCode)) {
        return stopCode;
    }

    if (stopCode === 'EBT YARD' || normalizeCode(stop?.stop_name) === 'EBT YARD') {
        return 'EBT_YARD';
    }

    return null;

};

const getSpecialStopUpdateCodes = (stopCode) => (
    stopCode === 'EBT_YARD' ? ['EBT_YARD', 'EBT YARD'] : [stopCode]
);

const getSpecialStopUpdateNames = (stopCode) => (
    stopCode === 'EBT_YARD' ? ['EBT YARD'] : []
);

const buildSpecialGeofenceStopsByCode = (stops = []) => (
    stops.reduce((map, stop) => {
        const stopCode = resolveSpecialGeofenceStopCode(stop);

        if (stopCode) {
            map.set(stopCode, stop);
        }

        return map;
    }, new Map())
);

const toLocalStoredDateOrNull = (value) => {

    if (!hasValue(value)) {
        return null;
    }

    const date = value instanceof Date
        ? value
        : new Date(String(value).replace(' ', 'T'));

    return Number.isNaN(date.getTime()) ? null : date;

};

const isMcleodSource = (source) => (
    normalizeCode(source || 'MCLEOD') === 'MCLEOD'
);

const isGeofenceSource = (source) => (
    normalizeCode(source) === 'GPS_GEOFENCE'
);

const addMinutes = (date, minutes) => (
    new Date(date.getTime() + (minutes * 60 * 1000))
);

const buildStopState = (stop) => {

    const shouldIgnoreArrival = isMcleodSource(stop?.actual_arrival_source);
    const shouldIgnoreDeparture = isMcleodSource(stop?.actual_departure_source);
    const actualArrival = shouldIgnoreArrival ? null : toLocalStoredDateOrNull(stop?.actual_arrival);
    const actualDeparture = shouldIgnoreDeparture ? null : toLocalStoredDateOrNull(stop?.actual_departure);

    return {
        stop,
        crossStopId: getStopId(stop),
        actualArrival,
        actualArrivalSql: toLocalSqlDateTime(actualArrival),
        actualArrivalSource: shouldIgnoreArrival
            ? INFERRED_FROM_GEOFENCE_SOURCE
            : stop?.actual_arrival_source || INFERRED_FROM_GEOFENCE_SOURCE,
        actualArrivalSourceRecordId: shouldIgnoreArrival ? null : stop?.actual_arrival_source_record_id || null,
        actualDeparture,
        actualDepartureSql: toLocalSqlDateTime(actualDeparture),
        actualDepartureSource: shouldIgnoreDeparture
            ? INFERRED_FROM_GEOFENCE_SOURCE
            : stop?.actual_departure_source || INFERRED_FROM_GEOFENCE_SOURCE,
        actualDepartureSourceRecordId: shouldIgnoreDeparture ? null : stop?.actual_departure_source_record_id || null,
    };

};

const setStateTimes = ({
    state,
    actualArrivalDate,
    actualArrivalSourceRecordId = null,
    actualDepartureDate = null,
    actualDepartureSourceRecordId = null,
} = {}) => {

    state.actualArrival = actualArrivalDate;
    state.actualArrivalSql = toLocalSqlDateTime(actualArrivalDate);
    state.actualArrivalSource = INFERRED_FROM_GEOFENCE_SOURCE;
    state.actualArrivalSourceRecordId = actualArrivalSourceRecordId;
    state.actualDeparture = actualDepartureDate;
    state.actualDepartureSql = toLocalSqlDateTime(actualDepartureDate);
    state.actualDepartureSource = INFERRED_FROM_GEOFENCE_SOURCE;
    state.actualDepartureSourceRecordId = actualDepartureSourceRecordId;

};

const isValidCompletedStateBefore = (state, referenceArrivalDate) => (
    state?.actualArrival
    && state?.actualDeparture
    && state.actualDeparture.getTime() > state.actualArrival.getTime()
    && state.actualDeparture.getTime() < referenceArrivalDate.getTime()
);

const buildCompletedIntervalBeforeReference = ({
    state,
    referenceArrivalDate,
    arrivalMinutesBefore,
    departureMinutesBefore,
} = {}) => {

    if (!referenceArrivalDate) {
        return null;
    }

    const referenceTime = referenceArrivalDate.getTime();
    const arrivalDate = state?.actualArrival || addMinutes(referenceArrivalDate, -arrivalMinutesBefore);
    let departureDate = state?.actualDeparture || addMinutes(referenceArrivalDate, -departureMinutesBefore);
    let usedExistingDeparture = Boolean(state?.actualDeparture);

    if (arrivalDate.getTime() >= referenceTime) {
        return null;
    }

    if (departureDate.getTime() <= arrivalDate.getTime() || departureDate.getTime() >= referenceTime) {
        const midpointTime = Math.floor((arrivalDate.getTime() + referenceTime) / 2);
        departureDate = new Date(midpointTime);
        usedExistingDeparture = false;
    }

    if (departureDate.getTime() <= arrivalDate.getTime()) {
        departureDate = addMinutes(arrivalDate, 1);
        usedExistingDeparture = false;
    }

    if (departureDate.getTime() >= referenceTime) {
        departureDate = addMinutes(referenceArrivalDate, -1);
        usedExistingDeparture = false;
    }

    if (departureDate.getTime() <= arrivalDate.getTime() || departureDate.getTime() >= referenceTime) {
        return null;
    }

    return {
        arrivalDate,
        departureDate,
        usedExistingDeparture,
    };

};

const completeStopBeforeReference = async ({
    state,
    stopCode,
    referenceStopCode,
    referenceArrivalDate,
    referenceArrivalSql,
    sourceRecordId,
    arrivalMinutesBefore,
    departureMinutesBefore,
} = {}) => {

    if (!state?.crossStopId || !referenceArrivalDate) {
        return null;
    }

    if (isValidCompletedStateBefore(state, referenceArrivalDate)) {
        return null;
    }

    if (state.actualDeparture && isGeofenceSource(state.actualDepartureSource)) {
        return null;
    }

    const interval = buildCompletedIntervalBeforeReference({
        state,
        referenceArrivalDate,
        arrivalMinutesBefore,
        departureMinutesBefore,
    });

    if (!interval) {
        return null;
    }

    setStateTimes({
        state,
        actualArrivalDate: interval.arrivalDate,
        actualArrivalSourceRecordId: state.actualArrivalSourceRecordId || sourceRecordId,
        actualDepartureDate: interval.departureDate,
        actualDepartureSourceRecordId: interval.usedExistingDeparture
            ? state.actualDepartureSourceRecordId || sourceRecordId
            : sourceRecordId,
    });

    await persistSpecialStopState({
        state,
        stopCode,
    });

    return {
        cross_stop_id: state.crossStopId,
        stop_code: stopCode,
        action: `INFERRED_COMPLETED_BEFORE_${referenceStopCode}`,
        actual_arrival: state.actualArrivalSql,
        actual_departure: state.actualDepartureSql,
        reference_stop_code: referenceStopCode,
        reference_arrival: referenceArrivalSql,
    };

};

const persistSpecialStopState = async ({
    state,
    stopCode,
} = {}) => updateCrossSpecialStopGeofenceTimes({
    cross_stop_id: state.crossStopId,
    stop_codes: getSpecialStopUpdateCodes(stopCode),
    stop_names: getSpecialStopUpdateNames(stopCode),
    actual_arrival: state.actualArrivalSql,
    actual_arrival_source: state.actualArrivalSource,
    actual_arrival_source_record_id: state.actualArrivalSourceRecordId,
    actual_departure: state.actualDepartureSql,
    actual_departure_source: state.actualDepartureSource,
    actual_departure_source_record_id: state.actualDepartureSourceRecordId,
});

const getStopId = (stop) => (
    stop?.id || stop?.cross_stop_id || stop?.stop_id || null
);

const buildPayloadStopsByMcleodStopId = (stops = []) => (
    stops.reduce((map, stop) => {
        for (const mcleodStopId of [
            stop?._mcleod_stop_id,
            ...(stop?._merged_mcleod_stop_ids || []),
        ]) {
            const key = toKey(mcleodStopId);

            if (key) {
                map.set(key, stop);
            }
        }

        return map;
    }, new Map())
);

const findAssignmentStop = ({ mcleodStopId, payloadStopsByMcleodStopId, dbStopsBySequence }) => {

    const payloadStop = payloadStopsByMcleodStopId.get(toKey(mcleodStopId));

    if (!payloadStop?.sequence) {
        return {
            payloadStop,
            dbStop: null,
        };
    }

    return {
        payloadStop,
        dbStop: dbStopsBySequence.get(toKey(payloadStop.sequence)) || null,
    };

};

const updateStopsForCross = async ({ crossId, stops = [] }) => {

    const updatedStops = [];
    const skippedStops = [];

    for (const stop of stops) {
        try {
            const updatedStop = await upsertCrossStopSync({
                ...stop,
                cross_id: crossId,
            });

            updatedStops.push({
                ...stop,
                ...updatedStop,
            });
        } catch (error) {
            skippedStops.push({
                stop,
                reason: error.message,
            });
        }
    }

    return {
        updatedStops,
        skippedStops,
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

const deleteStaleStopsForCross = async ({ crossId, stops = [] }) => {

    const maxSequence = stops.reduce((max, stop) => (
        Math.max(max, Number(stop?.sequence || 0))
    ), 0);

    if (!maxSequence) {
        return { deleted_count: 0 };
    }

    return deleteUnreferencedCrossStopsAfterSequence({
        cross_id: crossId,
        max_sequence: maxSequence,
    });

};

const getSortedCustomsEvents = async ({
    trailerId,
    stopCode,
    start,
    end,
} = {}) => {

    const geofences = SPECIAL_GEOFENCES_BY_STOP_CODE[stopCode] || [];
    const eventSets = await Promise.all(
        geofences.map((geofence) => (
            getTkGeofenceEvents({
                vehicle: trailerId,
                geofence,
                start,
                end,
            })
        ))
    );

    return eventSets
        .flat()
        .map((event) => {
            const eventDate = toUtcStoredDateOrNull(event.date_event);

            return {
                ...event,
                _event_date: eventDate,
                _event_date_sql: toLocalSqlDateTime(eventDate),
            };
        })
        .filter((event) => event._event_date && event._event_date_sql)
        .sort((a, b) => (
            a._event_date.getTime() - b._event_date.getTime()
            || Number(a.id || 0) - Number(b.id || 0)
        ));

};

const completeMissingPreviousCustomsStops = async ({
    statesByCode,
} = {}) => {

    const pensionState = statesByCode.get('PENSIEBT');
    const mxState = statesByCode.get('MX_CUSTOMS');
    const usState = statesByCode.get('US_CUSTOMS');
    const inferredStops = [];

    if (!pensionState?.crossStopId || !mxState?.crossStopId) {
        return inferredStops;
    }

    if (mxState.actualArrival) {
        const inferredPensionStop = await completeStopBeforeReference({
            state: pensionState,
            stopCode: 'PENSIEBT',
            referenceStopCode: 'MX_CUSTOMS',
            referenceArrivalDate: mxState.actualArrival,
            referenceArrivalSql: mxState.actualArrivalSql,
            sourceRecordId: mxState.actualArrivalSourceRecordId,
            arrivalMinutesBefore: 20,
            departureMinutesBefore: 10,
        });

        if (inferredPensionStop) {
            inferredStops.push(inferredPensionStop);
        }
    }

    if (usState?.actualArrival) {
        const sourceRecordId = usState.actualArrivalSourceRecordId;

        const inferredMxStop = await completeStopBeforeReference({
            state: mxState,
            stopCode: 'MX_CUSTOMS',
            referenceStopCode: 'US_CUSTOMS',
            referenceArrivalDate: usState.actualArrival,
            referenceArrivalSql: usState.actualArrivalSql,
            sourceRecordId,
            arrivalMinutesBefore: 20,
            departureMinutesBefore: 10,
        });

        if (inferredMxStop) {
            inferredStops.push(inferredMxStop);
        }

        const pensionReferenceDate = mxState.actualArrival || usState.actualArrival;
        const pensionReferenceCode = mxState.actualArrival ? 'MX_CUSTOMS' : 'US_CUSTOMS';
        const pensionReferenceSql = mxState.actualArrivalSql || usState.actualArrivalSql;
        const pensionSourceRecordId = mxState.actualArrivalSourceRecordId || sourceRecordId;
        const inferredPensionStop = await completeStopBeforeReference({
            state: pensionState,
            stopCode: 'PENSIEBT',
            referenceStopCode: pensionReferenceCode,
            referenceArrivalDate: pensionReferenceDate,
            referenceArrivalSql: pensionReferenceSql,
            sourceRecordId: pensionSourceRecordId,
            arrivalMinutesBefore: 20,
            departureMinutesBefore: 10,
        });

        if (inferredPensionStop) {
            inferredStops.push(inferredPensionStop);
        }
    }

    return inferredStops;

};

const updateCustomsTimesFromGeofenceForCross = async ({ dbStops = [], trailerId = null }) => {

    const updatedGeofenceStops = [];
    const skippedGeofenceStops = [];

    if (!trailerId) {
        return {
            updatedGeofenceStops,
            skippedGeofenceStops,
        };
    }

    const window = buildCurrentLocalDayUtcWindow();
    const specialStopsByCode = buildSpecialGeofenceStopsByCode(dbStops);
    const statesByCode = new Map(
        [...SPECIAL_GEOFENCE_STOP_CODES]
            .map((stopCode) => [stopCode, buildStopState(specialStopsByCode.get(stopCode))])
            .filter(([, state]) => state.crossStopId)
    );

    for (const stopCode of GEOFENCE_EVENT_STOP_CODES) {
        const state = statesByCode.get(stopCode);
        const crossStopId = state?.crossStopId;

        if (!crossStopId) {
            continue;
        }

        try {
            const events = await getSortedCustomsEvents({
                trailerId,
                stopCode,
                ...window,
            });

            for (const event of events) {
                const eventName = normalizeCode(event.event);

                if (eventName === 'GEOFENCE ENTRY') {
                    if (state.actualArrival || state.actualDeparture) {
                        continue;
                    }

                    await updateCrossSpecialStopGeofenceTimes({
                        cross_stop_id: crossStopId,
                        stop_codes: getSpecialStopUpdateCodes(stopCode),
                        stop_names: getSpecialStopUpdateNames(stopCode),
                        actual_arrival: event._event_date_sql,
                        actual_arrival_source_record_id: event.id || null,
                        actual_departure: null,
                        actual_departure_source_record_id: null,
                    });

                    state.actualArrival = event._event_date;
                    state.actualArrivalSql = event._event_date_sql;
                    state.actualArrivalSource = 'GPS_GEOFENCE';
                    state.actualArrivalSourceRecordId = event.id || null;

                    updatedGeofenceStops.push({
                        cross_stop_id: crossStopId,
                        stop_code: stopCode,
                        action: 'ARRIVAL',
                        event_id: event.id || null,
                        event_details: event.event_details,
                        actual_arrival: event._event_date_sql,
                    });
                    continue;
                }

                if (eventName !== 'GEOFENCE EXIT') {
                    continue;
                }

                if (!state.actualArrival || event._event_date.getTime() <= state.actualArrival.getTime()) {
                    continue;
                }

                if (state.actualDeparture) {
                    continue;
                }

                await updateCrossSpecialStopGeofenceTimes({
                    cross_stop_id: crossStopId,
                    stop_codes: getSpecialStopUpdateCodes(stopCode),
                    stop_names: getSpecialStopUpdateNames(stopCode),
                    actual_arrival: state.actualArrivalSql,
                    actual_arrival_source: state.actualArrivalSource,
                    actual_arrival_source_record_id: state.actualArrivalSourceRecordId,
                    actual_departure: event._event_date_sql,
                    actual_departure_source: 'GPS_GEOFENCE',
                    actual_departure_source_record_id: event.id || null,
                });

                state.actualDeparture = event._event_date;
                state.actualDepartureSql = event._event_date_sql;
                state.actualDepartureSource = 'GPS_GEOFENCE';
                state.actualDepartureSourceRecordId = event.id || null;

                updatedGeofenceStops.push({
                    cross_stop_id: crossStopId,
                    stop_code: stopCode,
                    action: 'DEPARTURE',
                    event_id: event.id || null,
                    event_details: event.event_details,
                    actual_arrival: state.actualArrivalSql,
                    actual_departure: event._event_date_sql,
                });
            }
        } catch (error) {
            skippedGeofenceStops.push({
                cross_stop_id: crossStopId,
                stop_code: stopCode,
                reason: error.message,
            });
        }
    }

    try {
        updatedGeofenceStops.push(...await completeMissingPreviousCustomsStops({
            statesByCode,
        }));
    } catch (error) {
        skippedGeofenceStops.push({
            stop_code: 'PENSIEBT/MX_CUSTOMS',
            reason: error.message,
        });
    }

    return {
        window,
        updatedGeofenceStops,
        skippedGeofenceStops,
    };

};

const upsertAssignmentsForCross = async ({
    crossId,
    orderId,
    assignments = [],
    stops = [],
    dbStops = [],
}) => {

    const upsertedAssignments = [];
    const skippedAssignments = [];
    const dbStopsBySequence = buildDbStopsBySequence(dbStops);
    const payloadStopsByMcleodStopId = buildPayloadStopsByMcleodStopId(stops);

    for (const assignment of assignments) {
        const originStop = findAssignmentStop({
            mcleodStopId: assignment._origin_mcleod_stop_id,
            payloadStopsByMcleodStopId,
            dbStopsBySequence,
        });
        const destinationStop = findAssignmentStop({
            mcleodStopId: assignment._destination_mcleod_stop_id,
            payloadStopsByMcleodStopId,
            dbStopsBySequence,
        });
        const originStopId = originStop.dbStop?.id || originStop.dbStop?.cross_stop_id || null;
        const destinationStopId = destinationStop.dbStop?.id || destinationStop.dbStop?.cross_stop_id || null;

        if (!originStopId || !destinationStopId) {
            skippedAssignments.push({
                assignment,
                reason: 'missing_origin_or_destination_stop_id',
                originSequence: originStop.payloadStop?.sequence || null,
                destinationSequence: destinationStop.payloadStop?.sequence || null,
            });
            continue;
        }

        try {
            await upsertCurrentCrossAssignment({
                ...assignment,
                cross_id: crossId,
                mcleod_order_id: orderId,
                origin_stop_id: originStopId,
                origin_stop_sequence: originStop.payloadStop?.sequence || null,
                destination_stop_id: destinationStopId,
                destination_stop_sequence: destinationStop.payloadStop?.sequence || null,
            });

            upsertedAssignments.push(assignment);
        } catch (error) {
            skippedAssignments.push({
                assignment,
                reason: error.message,
            });
        }
    }

    return {
        upsertedAssignments,
        skippedAssignments,
    };

};

export const persistActiveCrossesUpdate = async ({ items = [] } = {}) => {

    const results = [];
    const skippedCrosses = [];

    for (const item of items) {
        const crossId = item.crossId;
        const orderId = item.orderId;
        const crossPayload = item.crossPayload;

        if (!crossId || !orderId || !crossPayload?.isValid || !crossPayload?.cross) {
            skippedCrosses.push({
                orderId,
                crossId,
                reason: 'invalid_update_payload',
                item,
            });
            continue;
        }

        try {
            await updateCrossFromMcleod({
                ...crossPayload.cross,
                cross_id: crossId,
            });

            const trailerId = firstValue(
                crossPayload.cross.trailer_id,
                item.activeCross?.trailer_id,
                item.activeCross?.caja,
                item.activeCross?.trailer,
            );
            const gps = await getGpsForTrailer(trailerId);
            const stopsEtaResult = await enrichStopsEta({
                stops: item.stopsPayload?.stops || [],
                gps,
            });
            const stops = stopsEtaResult.stops || [];
            const assignments = item.assignmentPayload?.assignments || [];
            const stopsResult = await updateStopsForCross({
                crossId,
                stops,
            });
            const staleStopsResult = await deleteStaleStopsForCross({
                crossId,
                stops,
            });
            const refreshedDetail = await getCrossDetailById(crossId);
            const dbStops = refreshedDetail?.stops || item.dbDetail?.stops || [];
            const geofenceCustomsResult = await updateCustomsTimesFromGeofenceForCross({
                dbStops,
                trailerId,
            });
            const estimatedCustomsResult = {
                updatedEstimatedStops: [],
                skippedEstimatedStops: [],
            };
            const assignmentsResult = await upsertAssignmentsForCross({
                crossId,
                orderId,
                assignments,
                stops,
                dbStops,
            });

            results.push({
                orderId,
                crossId,
                updatedStopsCount: stopsResult.updatedStops.length,
                skippedStopsCount: stopsResult.skippedStops.length,
                deletedStaleStopsCount: Number(staleStopsResult.deleted_count || 0),
                deletedStaleAssignmentsCount: Number(staleStopsResult.deleted_assignments_count || 0),
                deletedStaleCustomsCount: Number(staleStopsResult.deleted_customs_count || 0),
                updatedEstimatedCustomsStopsCount: estimatedCustomsResult.updatedEstimatedStops.length,
                skippedEstimatedCustomsStopsCount: estimatedCustomsResult.skippedEstimatedStops.length,
                updatedGeofenceCustomsStopsCount: geofenceCustomsResult.updatedGeofenceStops.length,
                skippedGeofenceCustomsStopsCount: geofenceCustomsResult.skippedGeofenceStops.length,
                upsertedAssignmentsCount: assignmentsResult.upsertedAssignments.length,
                skippedAssignmentsCount: assignmentsResult.skippedAssignments.length,
                activeStopEta: stopsEtaResult.activeStopEta,
                skippedActiveStopEtaReason: stopsEtaResult.skippedReason,
                skippedStops: stopsResult.skippedStops,
                updatedEstimatedCustomsStops: estimatedCustomsResult.updatedEstimatedStops,
                skippedEstimatedCustomsStops: estimatedCustomsResult.skippedEstimatedStops,
                updatedGeofenceCustomsStops: geofenceCustomsResult.updatedGeofenceStops,
                skippedGeofenceCustomsStops: geofenceCustomsResult.skippedGeofenceStops,
                skippedAssignments: assignmentsResult.skippedAssignments,
            });
        } catch (error) {
            skippedCrosses.push({
                orderId,
                crossId,
                reason: error.message,
                item,
            });
        }
    }

    return {
        crossesCount: items.length,
        updatedCrossesCount: results.length,
        skippedCrossesCount: skippedCrosses.length,
        updatedStopsCount: results.reduce((total, result) => total + result.updatedStopsCount, 0),
        skippedStopsCount: results.reduce((total, result) => total + result.skippedStopsCount, 0),
        activeStopEtasCount: results.filter((result) => result.activeStopEta).length,
        skippedActiveStopEtasCount: results.filter((result) => result.skippedActiveStopEtaReason).length,
        deletedStaleStopsCount: results.reduce((total, result) => total + result.deletedStaleStopsCount, 0),
        deletedStaleAssignmentsCount: results.reduce((total, result) => total + result.deletedStaleAssignmentsCount, 0),
        deletedStaleCustomsCount: results.reduce((total, result) => total + result.deletedStaleCustomsCount, 0),
        updatedEstimatedCustomsStopsCount: results.reduce((total, result) => total + result.updatedEstimatedCustomsStopsCount, 0),
        skippedEstimatedCustomsStopsCount: results.reduce((total, result) => total + result.skippedEstimatedCustomsStopsCount, 0),
        updatedGeofenceCustomsStopsCount: results.reduce((total, result) => total + result.updatedGeofenceCustomsStopsCount, 0),
        skippedGeofenceCustomsStopsCount: results.reduce((total, result) => total + result.skippedGeofenceCustomsStopsCount, 0),
        upsertedAssignmentsCount: results.reduce((total, result) => total + result.upsertedAssignmentsCount, 0),
        skippedAssignmentsCount: results.reduce((total, result) => total + result.skippedAssignmentsCount, 0),
        results,
        skippedCrosses,
    };

};
