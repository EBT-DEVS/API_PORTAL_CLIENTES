import { getCrossStatuses } from '../../models/crosses/crosses.cat.statuses.model.js';

const normalizeNullableString = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    return String(value).trim() || null;

};

export const getCatCrossStatuses = async (req, res, next) => {

    try {
        const code = normalizeNullableString(req.query?.code)?.toUpperCase();
        const statuses = await getCrossStatuses(code);

        return res.json({
            success: true,
            data: statuses,
        });
    } catch (error) {
        return next(error);
    }

};
