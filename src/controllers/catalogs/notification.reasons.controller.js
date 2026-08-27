import { getNotificationReasons } from '../../models/catalogs/notification.reasons.model.js';

const normalizeNullableNumber = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number(value);

    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : NaN;

};

const normalizeNullableBooleanNumber = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const normalizedValue = String(value).trim().toLowerCase();

    if (['1', 'true', 'yes', 'y'].includes(normalizedValue)) {
        return 1;
    }

    if (['0', 'false', 'no', 'n'].includes(normalizedValue)) {
        return 0;
    }

    return NaN;

};

const normalizeNullableString = (value) => {

    if (value === undefined || value === null) {
        return null;
    }

    const normalizedValue = String(value).trim();

    return normalizedValue || null;

};

const badRequest = (res, message) => res.status(400).json({
    success: false,
    message,
});

export const getCatNotificationReasons = async (req, res, next) => {

    try {
        const id = normalizeNullableNumber(req.query?.id);
        const name = normalizeNullableString(req.query?.name);
        const nameEs = normalizeNullableString(req.query?.name_es ?? req.query?.nameEs);
        const isActive = normalizeNullableBooleanNumber(req.query?.is_active ?? req.query?.isActive);

        if (Number.isNaN(id)) {
            return badRequest(res, 'id invalido');
        }

        if (Number.isNaN(isActive)) {
            return badRequest(res, 'is_active invalido');
        }

        const reasons = await getNotificationReasons({
            id,
            name,
            nameEs,
            isActive,
        });

        return res.json({
            success: true,
            data: reasons,
        });
    } catch (error) {
        return next(error);
    }

};
