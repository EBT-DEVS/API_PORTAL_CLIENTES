import { getNotificationChannels } from '../../models/catalogs/notification.channels.model.js';

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

export const getCatNotificationChannels = async (req, res, next) => {

    try {
        const id = normalizeNullableNumber(req.query?.id);
        const isActive = normalizeNullableBooleanNumber(req.query?.is_active ?? req.query?.isActive);

        if (Number.isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'id invalido',
            });
        }

        if (Number.isNaN(isActive)) {
            return res.status(400).json({
                success: false,
                message: 'is_active invalido',
            });
        }

        const channels = await getNotificationChannels({
            id,
            isActive,
        });

        return res.json({
            success: true,
            data: channels,
        });
    } catch (error) {
        return next(error);
    }

};
