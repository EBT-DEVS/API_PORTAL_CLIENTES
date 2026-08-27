import { getSystemDataLastUpdated } from '../../models/system/system.model.js';

export const getDataLastUpdated = async (_req, res, next) => {

    try {
        const data = await getSystemDataLastUpdated();

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        return next(error);
    }

};
