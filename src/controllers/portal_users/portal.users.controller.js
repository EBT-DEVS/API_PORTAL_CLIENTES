import {
    getPortalUsers,
    insertPortalUser,
    updatePortalUser,
} from '../../models/portal_users/portal.users.model.js';

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

const normalizeNullableInteger = (value) => {

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number(value);

    return Number.isInteger(parsedValue) ? parsedValue : NaN;

};

const normalizeRequiredInteger = (value) => {

    const parsedValue = normalizeNullableInteger(value);

    return parsedValue === null ? NaN : parsedValue;

};

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null) ?? null
);

const normalizePortalUserPayload = (body = {}, { isUpdate = false } = {}) => {

    const nombres = normalizeRequiredString(body.nombres);
    const apellidos = normalizeRequiredString(body.apellidos);
    const email = normalizeRequiredString(body.email);
    const password = normalizeRequiredString(body.password);
    const idPerfil = normalizeNullableInteger(body.id_perfil ?? body.idPerfil);
    const yardId = normalizeNullableInteger(body.yard_id ?? body.yardId);
    const customerCode = normalizeNullableString(body.customer_code ?? body.customerCode);
    const customerName = normalizeNullableString(body.customer_name ?? body.customerName);
    const estado = normalizeNullableInteger(body.estado);
    const portalGroudId = normalizeNullableInteger(firstValue(
        body.portal_groud_id,
        body.portalGroudId,
        body.portal_group_id,
        body.portalGroupId,
    ));

    if (!nombres) {
        throw new Error('nombres es requerido');
    }

    if (!apellidos) {
        throw new Error('apellidos es requerido');
    }

    if (!email) {
        throw new Error('email es requerido');
    }

    if (!isUpdate && !password) {
        throw new Error('password es requerido');
    }

    if (Number.isNaN(idPerfil)) {
        throw new Error('id_perfil invalido');
    }

    if (Number.isNaN(yardId)) {
        throw new Error('yard_id invalido');
    }

    if (Number.isNaN(estado)) {
        throw new Error('estado invalido');
    }

    if (Number.isNaN(portalGroudId)) {
        throw new Error('portal_groud_id invalido');
    }

    return {
        nombres,
        apellidos,
        email,
        password,
        idPerfil,
        yardId: yardId ?? 0,
        customerCode: customerCode || 'EBT',
        customerName: customerName || 'EBT',
        estado: estado ?? 1,
        portalGroudId,
    };

};

export const getPortalUsersList = async (req, res, next) => {

    try {
        const portalGroudId = normalizeNullableInteger(firstValue(
            req.query?.portal_groud_id,
            req.query?.portalGroudId,
            req.query?.portal_group_id,
            req.query?.portalGroupId,
        ));

        if (Number.isNaN(portalGroudId)) {
            return badRequest(res, 'portal_groud_id invalido');
        }

        const data = await getPortalUsers({
            nombre: normalizeNullableString(req.query?.nombre ?? req.query?.name),
            email: normalizeNullableString(req.query?.email),
            customerName: normalizeNullableString(req.query?.customer_name ?? req.query?.customerName),
            portalGroudId,
        });

        return res.json({
            success: true,
            data,
        });
    } catch (error) {
        return next(error);
    }

};

export const createPortalUser = async (req, res, next) => {

    try {
        const payload = normalizePortalUserPayload(req.body || {});
        const data = await insertPortalUser(payload);

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

export const updatePortalUserById = async (req, res, next) => {

    try {
        const idUsuario = normalizeRequiredInteger(req.params?.id);

        if (Number.isNaN(idUsuario)) {
            return badRequest(res, 'id invalido');
        }

        const payload = normalizePortalUserPayload(req.body || {}, {
            isUpdate: true,
        });
        const data = await updatePortalUser({
            idUsuario,
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
