import {
    insertCrossEvent,
    updateCrossEvent,
} from '../../models/crosses/cross.events.model.js';

const badRequest = (res, message) => res.status(400).json({
    success: false,
    message,
});

const normalizeNullablePositiveInteger = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number(value);

    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : NaN;

};

const normalizeNullableString = (value) => {

    if (value === undefined || value === null) {
        return null;
    }

    const normalizedValue = String(value).trim();

    return normalizedValue || null;

};

const normalizeRequiredDateTime = (value) => {

    const normalizedValue = normalizeNullableString(value);

    if (!normalizedValue) {
        return null;
    }

    const date = new Date(normalizedValue.replace(' ', 'T'));

    return Number.isNaN(date.getTime()) ? NaN : normalizedValue;

};

const normalizeNullableDateTime = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    return normalizeRequiredDateTime(value);

};

const normalizeCrossEventPayload = (body = {}, { isUpdate = false } = {}) => {

    const hasEndedAtValue = Object.prototype.hasOwnProperty.call(body, 'ended_at')
        || Object.prototype.hasOwnProperty.call(body, 'endedAt');
    const crossId = normalizeNullablePositiveInteger(body.cross_id ?? body.crossId);
    const eventId = normalizeNullablePositiveInteger(body.event_id ?? body.eventId);
    const startedAt = normalizeRequiredDateTime(body.started_at ?? body.startedAt);
    const endedAt = normalizeNullableDateTime(body.ended_at ?? body.endedAt);
    const notes = normalizeNullableString(body.notes);

    if (!isUpdate && !crossId) {
        throw new Error('cross_id es requerido');
    }

    if (!isUpdate && !eventId) {
        throw new Error('event_id es requerido');
    }

    if (!isUpdate && !startedAt) {
        throw new Error('started_at es requerido');
    }

    if (Number.isNaN(crossId)) {
        throw new Error('cross_id invalido');
    }

    if (Number.isNaN(eventId)) {
        throw new Error('event_id invalido');
    }

    if (Number.isNaN(startedAt)) {
        throw new Error('started_at invalido');
    }

    if (Number.isNaN(endedAt)) {
        throw new Error('ended_at invalido');
    }

    return {
        crossId,
        eventId,
        startedAt,
        endedAt,
        updateEndedAt: isUpdate ? hasEndedAtValue : true,
        notes,
    };

};

export const createCrossEvent = async (req, res, next) => {

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

export const updateCrossEventById = async (req, res, next) => {

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
