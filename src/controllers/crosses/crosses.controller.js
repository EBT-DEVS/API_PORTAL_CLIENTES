import { upsertCrossCustoms } from '../../models/crosses/crosses.customs.model.js';
import { getActiveCrossesData, getCrossDetailById, updateCrossPriority } from '../../models/crosses/crosses.model.js';
import { updateCrossStopTimes } from '../../models/crosses/crosses.stops.model.js';
import { getTrailerData } from '../../models/db_gps/trailers.model.js';

const normalizeString = (value) => (
    value == null ? null : String(value).trim()
);

const normalizeNullableString = (value) => {

    const normalizedValue = normalizeString(value);

    return normalizedValue || null;

};

const normalizeNullablePositiveInteger = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number(value);

    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : NaN;

};

const normalizeCustomerCodeFilter = (value) => {

    const customerCode = normalizeNullableString(value);

    return customerCode?.toUpperCase() === 'EBT' ? null : customerCode;

};

const normalizeBooleanNumber = (value) => (
    ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase()) || value === 1 ? 1 : 0
);

const normalizeNullableCrossFilter = (value) => {

    const normalizedValue = normalizeString(value)?.toLowerCase();

    if (!normalizedValue) {
        return null;
    }

    if (['1', 'true', 'yes', 'y'].includes(normalizedValue)) {
        return 1;
    }

    if (['0', 'false', 'no', 'n'].includes(normalizedValue)) {
        return 0;
    }

    if (normalizedValue === '2') {
        return 2;
    }

    return null;

};

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

const resolveGpsLocation = (gps) => firstValue(
    gps?.ubicacion,
    gps?.location,
    gps?.address,
    gps?.direccion,
    gps?.position,
    gps?.posicion,
    gps?.nearest_city,
    gps?.ciudad,
);

const enrichActiveCrossWithGps = async (cross, index) => {

    let gps = null;

    try {
        gps = cross?.caja ? await getTrailerData(cross.caja) : null;
    } catch (error) {
        gps = {
            error: error.message,
        };
    }

    return {
        indice: index + 1,
        ...cross,
        ubicacion: resolveGpsLocation(gps),
        gps,
    };

};

export const getActiveCrosses = async (req, res, next) => {

    try {
        const {
            customer_code,
            customerCode,
            customer_group_id,
            customerGroupId,
            is_cross,
            isCross,
            trailer_id,
            trailerId,
            po_number,
            poNumber,
            start,
            end,
        } = req.query || {};
        const isCrossRawValue = is_cross ?? isCross;
        const isCrossValue = normalizeNullableCrossFilter(isCrossRawValue);
        const customerGroupIdValue = normalizeNullablePositiveInteger(customer_group_id ?? customerGroupId);

        if (normalizeString(isCrossRawValue) && isCrossValue === null) {
            return res.status(400).json({
                success: false,
                message: 'is_cross invalido',
            });
        }

        if (Number.isNaN(customerGroupIdValue)) {
            return res.status(400).json({
                success: false,
                message: 'customer_group_id invalido',
            });
        }

        const activeCrosses = await getActiveCrossesData({
            customerCode: normalizeCustomerCodeFilter(customer_code ?? customerCode),
            customerGroupId: customerGroupIdValue,
            isCross: isCrossValue,
            trailerId: normalizeNullableString(trailer_id ?? trailerId),
            poNumber: normalizeNullableString(po_number ?? poNumber),
            start: normalizeNullableString(start),
            end: normalizeNullableString(end),
        });
        const activeCrossesWithGps = await Promise.all(
            activeCrosses.map(enrichActiveCrossWithGps)
        );

        return res.json({
            success: true,
            data: activeCrossesWithGps,
        });

    } catch (error) {
        return next(error);
    }

};

export const getCrossDetail = async (req, res, next) => {

    try {
        const crossId = Number(req.params.crossId);

        if (!Number.isInteger(crossId) || crossId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'crossId invalido',
            });
        }

        const crossDetail = await getCrossDetailById(crossId);

        if (!crossDetail) {
            return res.status(404).json({
                success: false,
                message: 'Cruce no encontrado',
            });
        }

        return res.json({
            success: true,
            data: crossDetail,
        });
    } catch (error) {
        return next(error);
    }

};

export const updateCrossPriorityById = async (req, res, next) => {

    try {
        const crossId = Number(req.params.crossId);
        const priorityId = normalizeNullablePositiveInteger(req.body?.priority_id ?? req.body?.priorityId);

        if (!Number.isInteger(crossId) || crossId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'crossId invalido',
            });
        }

        if (Number.isNaN(priorityId) || !priorityId) {
            return res.status(400).json({
                success: false,
                message: 'priority_id invalido',
            });
        }

        const cross = await updateCrossPriority({
            cross_id: crossId,
            priority_id: priorityId,
        });

        if (!cross) {
            return res.status(404).json({
                success: false,
                message: 'Cruce no encontrado',
            });
        }

        return res.json({
            success: true,
            data: cross,
        });
    } catch (error) {
        return next(error);
    }

};

export const saveCrossCustoms = async (req, res, next) => {

    try {
        const crossStopId = Number(req.params.crossStopId);
        const {
            customs_country,
            customsCountry,
            light,
            papers_ready,
            papersReady,
            comments,
            actual_arrival,
            actualArrival,
            actual_departure,
            actualDeparture,
        } = req.body || {};
        const customsCountryValue = normalizeString(customs_country || customsCountry)?.toUpperCase();
        const lightValue = normalizeString(light)?.toUpperCase();
        const commentsValue = normalizeString(comments);
        const actualArrivalValue = normalizeNullableString(actual_arrival ?? actualArrival);
        const actualDepartureValue = normalizeNullableString(actual_departure ?? actualDeparture);
        const shouldUpdateStopTimes = Boolean(actualArrivalValue || actualDepartureValue);

        if (!Number.isInteger(crossStopId) || crossStopId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'crossStopId invalido',
            });
        }

        if (!['MX', 'US'].includes(customsCountryValue)) {
            return res.status(400).json({
                success: false,
                message: 'customs_country invalido',
            });
        }

        if (lightValue && !['GREEN', 'RED'].includes(lightValue)) {
            return res.status(400).json({
                success: false,
                message: 'light invalido',
            });
        }

        if (commentsValue && commentsValue.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'comments excede 500 caracteres',
            });
        }

        const savedCustoms = await upsertCrossCustoms({
            cross_stop_id: crossStopId,
            customs_country: customsCountryValue,
            light: lightValue || null,
            papers_ready: normalizeBooleanNumber(papers_ready ?? papersReady ?? 0),
            comments: commentsValue || null,
        });
        const stopTimes = shouldUpdateStopTimes
            ? await updateCrossStopTimes({
                cross_stop_id: crossStopId,
                actual_arrival: actualArrivalValue,
                actual_departure: actualDepartureValue,
            })
            : null;

        return res.json({
            success: true,
            data: {
                ...savedCustoms,
                stop_times_updated: shouldUpdateStopTimes,
                stop_times: stopTimes,
            },
        });
    } catch (error) {
        return next(error);
    }

};
