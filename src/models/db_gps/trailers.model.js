import { executeSp } from '../../config/db/db.portal.config.js';

export const getTrailerData = async ( trailer ) => {

    const resultSets = await executeSp('sysebtapps_prd_gps_data.sp_ebt_trailer_positions_get', [
        trailer,
    ]);

    return resultSets[0]?.[0] || null;

}