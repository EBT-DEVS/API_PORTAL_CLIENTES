import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstResultSet = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet)) || []
);

export const insertCrossEvent = async ({
    crossId,
    eventId,
    startedAt,
    endedAt = null,
    notes = null,
} = {}) => {

    const resultSets = await executeSp('sp_cross_events_insert', [
        crossId,
        eventId,
        startedAt,
        endedAt,
        notes,
    ]);

    return getFirstResultSet(resultSets)[0] || null;

};

export const updateCrossEvent = async ({
    id,
    crossId = null,
    eventId = null,
    startedAt = null,
    endedAt = null,
    updateEndedAt = false,
    notes = null,
} = {}) => {

    const resultSets = await executeSp('sp_cross_events_update', [
        id,
        crossId,
        eventId,
        startedAt,
        endedAt,
        updateEndedAt ? 1 : 0,
        notes,
    ]);

    return getFirstResultSet(resultSets)[0] || null;

};
