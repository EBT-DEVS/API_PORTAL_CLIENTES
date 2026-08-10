import { upsertCurrentCrossAssignment } from '../../models/crosses/crosses.assignments.model.js';
import { getCrossDetailById, updateCrossFromMcleod } from '../../models/crosses/crosses.model.js';
import { deleteUnreferencedCrossStopsAfterSequence, updateCrossCustomsStopTimes, upsertCrossStopSync } from '../../models/crosses/crosses.stops.model.js';
import { getCustomsGeofencesContainingPoint } from '../../models/db_gps/geofences.model.js';
import { getTrailerData } from '../../models/db_gps/trailers.model.js';
import { enrichActiveStopEtaFromPcMiller } from './crossesPcMillerEta.service.js';

const toKey = (value) => (
    value == null ? null : String(value)
);

const normalizeCode = (value) => (
    value == null ? null : String(value).trim().toUpperCase()
);

const CUSTOMS_STOP_CODES = new Set(['MX_CUSTOMS', 'US_CUSTOMS']);

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

const sortBySequence = (stops = []) => (
    [...stops].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
);

const hasValue = (value) => (
    value !== undefined && value !== null && value !== ''
);

const toTimestamp = (value) => {

    if (!hasValue(value)) {
        return null;
    }

    if (value instanceof Date) {
        const timestamp = value.getTime();

        return Number.isFinite(timestamp) ? timestamp : null;
    }

    const timestamp = new Date(String(value).replace(' ', 'T')).getTime();

    return Number.isFinite(timestamp) ? timestamp : null;

};

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

const findStopByCode = (stops = [], code) => (
    stops.find((stop) => normalizeCode(stop?.stop_code) === code) || null
);

const findPreviousRealStop = (stops = [], targetStop) => (
    sortBySequence(stops)
        .filter((stop) => Number(stop.sequence) < Number(targetStop?.sequence))
        .reverse()
        .find((stop) => !CUSTOMS_STOP_CODES.has(normalizeCode(stop?.stop_code))) || null
);

const findNextRealStop = (stops = [], targetStop) => (
    sortBySequence(stops)
        .find((stop) => (
            Number(stop.sequence) > Number(targetStop?.sequence)
            && !CUSTOMS_STOP_CODES.has(normalizeCode(stop?.stop_code))
        )) || null
);

const buildDbStopsByCode = (stops = []) => (
    stops.reduce((map, stop) => {
        const stopCode = normalizeCode(stop?.stop_code);

        if (stopCode) {
            map.set(stopCode, stop);
        }

        return map;
    }, new Map())
);

const toNumberOrNull = (value) => {

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;

};

const isValidLatitude = (value) => (
    Number.isFinite(value) && value >= -90 && value <= 90
);

const isValidLongitude = (value) => (
    Number.isFinite(value) && value >= -180 && value <= 180
);

const normalizeCoordinates = ({ latitude, longitude }) => {

    if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
        return {
            latitude,
            longitude,
        };
    }

    if (isValidLatitude(longitude) && isValidLongitude(latitude)) {
        return {
            latitude: longitude,
            longitude: latitude,
        };
    }

    return {
        latitude,
        longitude,
    };

};

const resolveGpsCoordinates = (gps) => normalizeCoordinates({
    latitude: toNumberOrNull(firstValue(
        gps?.latitude,
        gps?.lat,
        gps?.Latitud,
        gps?.latitud,
    )),
    longitude: toNumberOrNull(firstValue(
        gps?.longitude,
        gps?.lng,
        gps?.lon,
        gps?.Longitud,
        gps?.longitud,
    )),
});

const resolveGpsTimestamp = (gps) => (
    toSqlDateTime(toTimestamp(firstValue(
        gps?.position_date,
        gps?.positionDate,
        gps?.created_at,
        gps?.createdAt,
    )) || Date.now())
);

const hasGpsCoordinates = (gps) => {

    const coordinates = resolveGpsCoordinates(gps);

    return isValidLatitude(coordinates.latitude) && isValidLongitude(coordinates.longitude);

};

const buildCustomsStopsByCode = (stops = []) => (
    stops.reduce((map, stop) => {
        const stopCode = normalizeCode(stop?.stop_code);

        if (CUSTOMS_STOP_CODES.has(stopCode)) {
            map.set(stopCode, stop);
        }

        return map;
    }, new Map())
);

const getStopId = (stop) => (
    stop?.id || stop?.cross_stop_id || stop?.stop_id || null
);

const estimateCustomsTimes = ({ stops = [], dbStops = [] }) => {

    const sortedStops = sortBySequence(stops);
    const mxCustoms = findStopByCode(sortedStops, 'MX_CUSTOMS');
    const usCustoms = findStopByCode(sortedStops, 'US_CUSTOMS');

    if (!mxCustoms || !usCustoms) {
        return [];
    }

    const previousStop = findPreviousRealStop(sortedStops, mxCustoms);
    const nextStop = findNextRealStop(sortedStops, usCustoms);

    if (!hasValue(previousStop?.actual_departure) || !hasValue(nextStop?.actual_arrival)) {
        return [];
    }

    const startTime = toTimestamp(previousStop.actual_departure);
    const endTime = toTimestamp(nextStop.actual_arrival);

    if (!startTime || !endTime || endTime <= startTime) {
        return [];
    }

    const midpoint = startTime + ((endTime - startTime) / 2);
    const dbStopsByCode = buildDbStopsByCode(dbStops);
    const estimates = [
        {
            stopCode: 'MX_CUSTOMS',
            actual_arrival: toSqlDateTime(startTime),
            actual_departure: toSqlDateTime(midpoint),
        },
        {
            stopCode: 'US_CUSTOMS',
            actual_arrival: toSqlDateTime(midpoint),
            actual_departure: toSqlDateTime(endTime),
        },
    ];

    return estimates
        .map((estimate) => {
            const dbStop = dbStopsByCode.get(estimate.stopCode);

            if (!dbStop?.id && !dbStop?.cross_stop_id && !dbStop?.stop_id) {
                return null;
            }

            return {
                ...estimate,
                cross_stop_id: dbStop.id || dbStop.cross_stop_id || dbStop.stop_id,
                actual_arrival: firstValue(dbStop.actual_arrival, estimate.actual_arrival),
                actual_departure: firstValue(dbStop.actual_departure, estimate.actual_departure),
                shouldUpdate: !hasValue(dbStop.actual_arrival) || !hasValue(dbStop.actual_departure),
            };
        })
        .filter(Boolean)
        .filter((estimate) => estimate.shouldUpdate);

};

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

const updateEstimatedCustomsTimesForCross = async ({ stops = [], dbStops = [] }) => {

    const estimatedStops = estimateCustomsTimes({
        stops,
        dbStops,
    });
    const updatedEstimatedStops = [];
    const skippedEstimatedStops = [];

    for (const estimatedStop of estimatedStops) {
        try {
            await updateCrossCustomsStopTimes({
                cross_stop_id: estimatedStop.cross_stop_id,
                actual_arrival: estimatedStop.actual_arrival,
                actual_departure: estimatedStop.actual_departure,
            });

            updatedEstimatedStops.push(estimatedStop);
        } catch (error) {
            skippedEstimatedStops.push({
                estimatedStop,
                reason: error.message,
            });
        }
    }

    return {
        updatedEstimatedStops,
        skippedEstimatedStops,
    };

};

const updateCustomsTimesFromGeofenceForCross = async ({ dbStops = [], gps = null }) => {

    const updatedGeofenceStops = [];
    const skippedGeofenceStops = [];

    if (!hasGpsCoordinates(gps)) {
        return {
            updatedGeofenceStops,
            skippedGeofenceStops,
        };
    }

    const coordinates = resolveGpsCoordinates(gps);
    const gpsTimestamp = resolveGpsTimestamp(gps);
    const customsStopsByCode = buildCustomsStopsByCode(dbStops);
    const geofences = await getCustomsGeofencesContainingPoint(coordinates);
    const insideStopCodes = new Set(geofences.map((geofence) => geofence.stop_code));

    for (const stopCode of CUSTOMS_STOP_CODES) {
        const dbStop = customsStopsByCode.get(stopCode);
        const crossStopId = getStopId(dbStop);

        if (!crossStopId) {
            continue;
        }

        try {
            if (insideStopCodes.has(stopCode) && !hasValue(dbStop.actual_arrival)) {
                await updateCrossCustomsStopTimes({
                    cross_stop_id: crossStopId,
                    actual_arrival: gpsTimestamp,
                    actual_departure: null,
                });

                updatedGeofenceStops.push({
                    cross_stop_id: crossStopId,
                    stop_code: stopCode,
                    action: 'ARRIVAL',
                    actual_arrival: gpsTimestamp,
                    geofences: geofences.filter((geofence) => geofence.stop_code === stopCode),
                });
            }

            if (!insideStopCodes.has(stopCode) && hasValue(dbStop.actual_arrival) && !hasValue(dbStop.actual_departure)) {
                await updateCrossCustomsStopTimes({
                    cross_stop_id: crossStopId,
                    actual_arrival: dbStop.actual_arrival,
                    actual_departure: gpsTimestamp,
                });

                updatedGeofenceStops.push({
                    cross_stop_id: crossStopId,
                    stop_code: stopCode,
                    action: 'DEPARTURE',
                    actual_arrival: dbStop.actual_arrival,
                    actual_departure: gpsTimestamp,
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

    return {
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

            const gps = await getGpsForTrailer(firstValue(
                crossPayload.cross.trailer_id,
                item.activeCross?.trailer_id,
                item.activeCross?.caja,
                item.activeCross?.trailer,
            ));
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
                gps,
            });
            const estimatedCustomsResult = geofenceCustomsResult.updatedGeofenceStops.length
                ? {
                    updatedEstimatedStops: [],
                    skippedEstimatedStops: [],
                }
                : await updateEstimatedCustomsTimesForCross({
                    stops,
                    dbStops,
                });
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
