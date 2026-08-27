import {
    getCrossEvents,
    insertCrossEvent,
    updateCrossEvent,
} from '../../models/crosses/crosses.cat.events.model.js';

const badRequest = (res, message) => res.status(400).json({
    success: false,
    message,
});

const normalizeNullableString = (value) => {

    if (value === undefined || value === null) {
        return null;
    }

    const normalizedValue = String(value).trim();

    return normalizedValue || null;

};

const normalizeRequiredString = (value) => normalizeNullableString(value);

const normalizeNullablePositiveInteger = (value) => {

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

const normalizeCrossEventPayload = (body = {}, { isUpdate = false } = {}) => {

    const code = normalizeRequiredString(body.code);
    const nameEs = normalizeRequiredString(body.name_es ?? body.nameEs);
    const nameEn = normalizeRequiredString(body.name_en ?? body.nameEn);
    const descriptionEs = normalizeNullableString(body.description_es ?? body.descriptionEs);
    const descriptionEn = normalizeNullableString(body.description_en ?? body.descriptionEn);
    const isActive = normalizeNullableBooleanNumber(body.is_active ?? body.isActive);

    if (!isUpdate && !code) {
        throw new Error('code es requerido');
    }

    if (!isUpdate && !nameEs) {
        throw new Error('name_es es requerido');
    }

    if (!isUpdate && !nameEn) {
        throw new Error('name_en es requerido');
    }

    if (Number.isNaN(isActive)) {
        throw new Error('is_active invalido');
    }

    return {
        code,
        nameEs,
        nameEn,
        descriptionEs,
        descriptionEn,
        isActive,
    };

};

export const getCatCrossEvents = async (req, res, next) => {

    try {
        const id = normalizeNullablePositiveInteger(req.query?.id);
        const isActive = normalizeNullableBooleanNumber(req.query?.is_active ?? req.query?.isActive);

        if (Number.isNaN(id)) {
            return badRequest(res, 'id invalido');
        }

        if (Number.isNaN(isActive)) {
            return badRequest(res, 'is_active invalido');
        }

        const data = await getCrossEvents({
            id,
            code: normalizeNullableString(req.query?.code)?.toUpperCase() || null,
            isActive,
        });

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        return next(error);
    }

};

export const createCatCrossEvent = async (req, res, next) => {

    try {
        const payload = normalizeCrossEventPayload(req.body || {});
        const data = await insertCrossEvent(payload);

        return res.status(201).json({
            success: true,
            data,
        });
    } catch (error) {
        if (error.message?.includes('requerido') || error.message?.includes('invalido')) {
            return badRequest(res, error.message);
        }

        return next(error);
    }

};

export const updateCatCrossEventById = async (req, res, next) => {

    try {
        const id = normalizeNullablePositiveInteger(req.params?.id);

        if (Number.isNaN(id) || !id) {
            return badRequest(res, 'id invalido');
        }

        const payload = normalizeCrossEventPayload(req.body || {}, {
            isUpdate: true,
        });
        const data = await updateCrossEvent({
            id,
            ...payload,
        });

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        if (error.message?.includes('requerido') || error.message?.includes('invalido')) {
            return badRequest(res, error.message);
        }

        return next(error);
    }

};
