import {
    getCustomerGroups,
    insertCustomerGroup,
    updateCustomerGroup,
} from '../../models/groups/customer.groups.model.js';

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

const normalizeRequiredString = (value) => {

    const normalizedValue = normalizeNullableString(value);

    return normalizedValue || null;

};

export const getCustomerGroupsData = async (req, res, next) => {

    try {
        const id = normalizeNullableNumber(req.query?.id);
        const name = normalizeNullableString(req.query?.name);
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

        const groups = await getCustomerGroups({
            id,
            name,
            isActive,
        });

        return res.json({
            success: true,
            data: groups,
        });
    } catch (error) {
        return next(error);
    }

};

export const createCustomerGroup = async (req, res, next) => {

    try {
        const body = req.body || {};
        const code = normalizeRequiredString(body.code);
        const name = normalizeRequiredString(body.name);
        const isActive = normalizeNullableBooleanNumber(body.is_active ?? body.isActive);

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'code es requerido',
            });
        }

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'name es requerido',
            });
        }

        if (Number.isNaN(isActive)) {
            return res.status(400).json({
                success: false,
                message: 'is_active invalido',
            });
        }

        const group = await insertCustomerGroup({
            code,
            name,
            isActive,
        });

        return res.status(201).json({
            success: true,
            data: group,
        });
    } catch (error) {
        return next(error);
    }

};

export const editCustomerGroup = async (req, res, next) => {

    try {
        const id = normalizeNullableNumber(req.params?.id);
        const body = req.body || {};
        const code = normalizeRequiredString(body.code);
        const name = normalizeRequiredString(body.name);
        const isActive = normalizeNullableBooleanNumber(body.is_active ?? body.isActive);

        if (Number.isNaN(id) || !id) {
            return res.status(400).json({
                success: false,
                message: 'id invalido',
            });
        }

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'code es requerido',
            });
        }

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'name es requerido',
            });
        }

        if (Number.isNaN(isActive)) {
            return res.status(400).json({
                success: false,
                message: 'is_active invalido',
            });
        }

        const group = await updateCustomerGroup({
            id,
            code,
            name,
            isActive,
        });

        return res.json({
            success: true,
            data: group,
        });
    } catch (error) {
        return next(error);
    }

};
