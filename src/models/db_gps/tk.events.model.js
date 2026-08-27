import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstResultSet = (resultSets = []) => {

    if (!Array.isArray(resultSets)) {
        return [];
    }

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};

export const getTkGeofenceEvents = async ({
    vehicle,
    geofence,
    start,
    end,
} = {}) => {

    if (!vehicle || !geofence || !start || !end) {
        return [];
    }

    const resultSets = await executeSp('sp_ebt_tk_geofence_events_get', [
        vehicle,
        geofence,
        start,
        end,
    ]);

    return getFirstResultSet(resultSets);

};
