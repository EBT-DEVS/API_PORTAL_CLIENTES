import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstResultSet = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet)) || []
);

export const getSystemDataLastUpdated = async () => {

    const resultSets = await executeSp('sp_system_data_last_updated_get');

    return getFirstResultSet(resultSets)[0] || null;

};
