import { executeSp } from '../../config/db/db.portal.config.js';

export const getMcleodRouteLocations = async () => {

    const resultSets = await executeSp('sysebtapps_prd_mcleod.sp_locations_get_data_routes');

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};
