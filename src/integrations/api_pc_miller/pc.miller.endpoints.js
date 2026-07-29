import { fetchPcMillerData } from './pc.miller.config.js';

const formatCoordinate = ({ longitude, latitude }) => {

    if (longitude == null || latitude == null) {
        throw new Error('longitude y latitude son requeridos para consultar PC Miller');
    }

    return `${longitude},${latitude}`;

};

const formatStops = (stops) => {

    if (typeof stops === 'string') {
        return stops;
    }

    if (!Array.isArray(stops) || stops.length < 2) {
        throw new Error('stops debe ser string o array con al menos 2 coordenadas');
    }

    return stops.map(formatCoordinate).join(';');

};

// ========================================
// GET ROUTE REPORTS
// ========================================

export const getRouteReports = async (stops, options = {}) => {

    const {
        reports = 'Mileage',
        vehType = 'Truck',
        useTraffic = false,
        estimatedTimeOpts = 'Depart',
        tHoursWithSeconds = true,
        ...extraOptions
    } = options;

    const data = await fetchPcMillerData(
        '/route/routeReports',
        {
            stops: formatStops(stops),
            reports,
            vehType,
            useTraffic,
            estimatedTimeOpts,
            tHoursWithSeconds,
            ...extraOptions,
        },
    );

    return data;

};

// ========================================
// GET MILEAGE AND ETA BETWEEN TWO POINTS
// ========================================

export const getMileageAndEta = async (origin, destination, options = {}) => {

    const data = await getRouteReports(
        [origin, destination],
        {
            reports: 'Mileage',
            vehType: 'Truck',
            useTraffic: false,
            estimatedTimeOpts: 'Depart',
            ...options,
        },
    );

    return data;

};
