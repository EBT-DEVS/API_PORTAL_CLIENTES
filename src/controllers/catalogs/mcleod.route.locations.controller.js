import { getMcleodRouteLocations } from '../../models/catalogs/mcleod.route.locations.model.js';

export const getCatMcleodRouteLocations = async (req, res, next) => {

    try {
        const locations = await getMcleodRouteLocations();

        return res.json({
            success: true,
            data: locations,
        });
    } catch (error) {
        return next(error);
    }

};
