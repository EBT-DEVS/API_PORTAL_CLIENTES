import { executeSp } from '../../config/db/db.portal.config.js';

export const getCrossStatuses = async (code = null) => {

    const resultSets = await executeSp('sp_cat_cross_statuses_get', [
        code,
    ]);

    return resultSets[0] || [];

};

export const getCrossStatusByCode = async (code) => {

    if (!code) {
        return null;
    }

    const statuses = await getCrossStatuses(code);

    return statuses[0] || null;

};
