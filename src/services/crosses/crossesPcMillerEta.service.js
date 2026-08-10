import { getMileageAndEta } from '../../integrations/api_pc_miller/pc.miller.endpoints.js';

const hasValue = (value) => (
    value !== undefined && value !== null && value !== ''
);

const sortBySequence = (stops = []) => (
    [...stops].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
);

const toNumberOrNull = (value) => {

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;

};

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

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

const hasCoordinates = (stop) => (
    Number.isFinite(toNumberOrNull(stop?.longitude))
    && Number.isFinite(toNumberOrNull(stop?.latitude))
);

const hasGpsCoordinates = (gps) => {

    const coordinates = resolveGpsCoordinates(gps);

    return isValidLongitude(coordinates.longitude)
        && isValidLatitude(coordinates.latitude);

};

const hasDepartureDate = (stop) => (
    hasValue(stop?.actual_departure)
);

const hasNoArrivalDate = (stop) => (
    !hasValue(stop?.actual_arrival)
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

const normalizeArray = (value) => {

    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];

};

const normalizeReportLines = (reportLines) => {

    if (Array.isArray(reportLines)) {
        return reportLines;
    }

    return [
        ...normalizeArray(reportLines?.MileageReportLine),
        ...normalizeArray(reportLines?.StopReportLine),
        ...normalizeArray(reportLines?.ReportLine),
    ];

};

const normalizeReports = (response) => {

    if (Array.isArray(response)) {
        return response;
    }

    return [
        ...normalizeArray(response?.Reports),
        ...normalizeArray(response?.Report),
        ...normalizeArray(response),
    ];

};

const findMileageReport = (response) => (
    normalizeReports(response)
        .find((report) => (
            report?.ReportLines
            || report?.__type?.includes?.('MileageReport')
            || report?.type?.includes?.('MileageReport')
        ))
    || null
);

const parseHours = (value) => {

    if (!hasValue(value)) {
        return null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    const normalizedValue = String(value).trim();
    const timeMatch = normalizedValue.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);

    if (timeMatch) {
        const [, hours, minutes, seconds = 0] = timeMatch;

        return Number(hours) + (Number(minutes) / 60) + (Number(seconds) / 3600);
    }

    const numberValue = Number(normalizedValue);

    return Number.isFinite(numberValue) ? numberValue : null;

};

const parsePcMillerTravelHours = (response) => {

    const mileageReport = findMileageReport(response);
    const lines = normalizeReportLines(mileageReport?.ReportLines);
    const destinationLine = lines[lines.length - 1] || null;

    return parseHours(destinationLine?.THours)
        ?? parseHours(destinationLine?.LHours)
        ?? parseHours(mileageReport?.THours)
        ?? null;

};

const parsePcMillerEta = (response) => {

    const mileageReport = findMileageReport(response);
    const lines = normalizeReportLines(mileageReport?.ReportLines);
    const destinationLine = lines[lines.length - 1] || null;

    return firstValue(
        destinationLine?.EtaEtd,
        destinationLine?.ETAETD,
        destinationLine?.ETA,
        destinationLine?.Eta,
        mileageReport?.EtaEtd,
        mileageReport?.ETAETD,
        mileageReport?.ETA,
        mileageReport?.Eta,
    );

};

const findActiveStopWithPrevious = (stops = []) => {

    const sortedStops = sortBySequence(stops);

    for (let index = 1; index < sortedStops.length; index++) {
        const previousStop = sortedStops[index - 1];
        const stop = sortedStops[index];

        if (hasDepartureDate(previousStop) && hasNoArrivalDate(stop)) {
            return {
                previousStop,
                activeStop: stop,
            };
        }
    }

    return {
        previousStop: null,
        activeStop: null,
    };

};

const clearStopsEta = (stops = []) => (
    stops.map((stop) => ({
        ...stop,
        eta: null,
    }))
);

export const enrichActiveStopEtaFromPcMiller = async ({ stops = [], gps = null } = {}) => {

    const stopsWithoutEta = clearStopsEta(stops);
    const {
        previousStop,
        activeStop,
    } = findActiveStopWithPrevious(stopsWithoutEta);

    if (!previousStop || !activeStop) {
        return {
            stops: stopsWithoutEta,
            activeStopEta: null,
            skippedReason: 'active_stop_not_found',
        };
    }

    if (!hasGpsCoordinates(gps) || !hasCoordinates(activeStop)) {
        return {
            stops: stopsWithoutEta,
            activeStopEta: null,
            skippedReason: 'missing_coordinates',
            activeStopSequence: activeStop.sequence,
        };
    }

    const origin = resolveGpsCoordinates(gps);
    const requestedAtTimestamp = Date.now();
    const response = await getMileageAndEta(
        {
            longitude: origin.longitude,
            latitude: origin.latitude,
        },
        {
            longitude: toNumberOrNull(activeStop.longitude),
            latitude: toNumberOrNull(activeStop.latitude),
        },
    );
    const pcMillerEta = parsePcMillerEta(response);
    const travelHours = parsePcMillerTravelHours(response);
    const eta = toSqlDateTime(toTimestamp(pcMillerEta))
        || toSqlDateTime(requestedAtTimestamp + (travelHours * 60 * 60 * 1000));

    if (!eta) {
        return {
            stops: stopsWithoutEta,
            activeStopEta: null,
            skippedReason: 'pc_miller_missing_eta',
            activeStopSequence: activeStop.sequence,
        };
    }

    return {
        stops: stopsWithoutEta.map((stop) => (
            Number(stop.sequence) === Number(activeStop.sequence)
                ? {
                    ...stop,
                    eta,
                }
                : stop
        )),
        activeStopEta: {
            eta,
            travelHours,
            origin: 'GPS',
            requestedAt: toSqlDateTime(requestedAtTimestamp),
            pcMillerEta: pcMillerEta || null,
            previousStopSequence: previousStop.sequence,
            activeStopSequence: activeStop.sequence,
        },
        skippedReason: null,
    };

};
