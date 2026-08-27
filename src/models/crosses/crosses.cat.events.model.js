import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstResultSet = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet)) || []
);

export const getCrossEvents = async ({
    id = null,
    code = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_cat_cross_events_get', [
        id,
        code,
        isActive,
    ]);

    return getFirstResultSet(resultSets);

};

export const insertCrossEvent = async ({
    code,
    nameEs,
    nameEn,
    descriptionEs = null,
    descriptionEn = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_cat_cross_events_insert', [
        code,
        nameEs,
        nameEn,
        descriptionEs,
        descriptionEn,
        isActive,
    ]);

    return getFirstResultSet(resultSets)[0] || null;

};

export const updateCrossEvent = async ({
    id,
    code = null,
    nameEs = null,
    nameEn = null,
    descriptionEs = null,
    descriptionEn = null,
    isActive = null,
} = {}) => {

    const resultSets = await executeSp('sp_cat_cross_events_update', [
        id,
        code,
        nameEs,
        nameEn,
        descriptionEs,
        descriptionEn,
        isActive,
    ]);

    return getFirstResultSet(resultSets)[0] || null;

};
