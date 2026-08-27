import {
    getCustomerGroupCrossPlants,
    insertCustomerGroupCrossPlant,
    updateCustomerGroupCrossPlant,
} from '../../models/groups/customer.group.cross.plants.model.js';

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

export const getCustomerGroupCrossPlantsData = async (req, res, next) => {

    try {
        const customerGroupId = normalizeNullableNumber(req.query?.customer_group_id ?? req.query?.customerGroupId);
        const locationName = normalizeNullableString(req.query?.location_name ?? req.query?.locationName);
        const isActive = normalizeNullableBooleanNumber(req.query?.is_active ?? req.query?.isActive);

        if (Number.isNaN(customerGroupId)) {
            return res.status(400).json({
                success: false,
                message: 'customer_group_id invalido',
            });
        }

        if (Number.isNaN(isActive)) {
            return res.status(400).json({
                success: false,
                message: 'is_active invalido',
            });
        }

        const plants = await getCustomerGroupCrossPlants({
            customerGroupId,
            locationName,
            isActive,
        });

        return res.json({
            success: true,
            data: plants,
        });
    } catch (error) {
        return next(error);
    }

};

export const createCustomerGroupCrossPlant = async (req, res, next) => {

    try {
        const body = req.body || {};
        const customerGroupId = normalizeNullableNumber(body.customer_group_id ?? body.customerGroupId);
        const plantLocationCode = normalizeNullableString(body.plant_location_code ?? body.plantLocationCode);
        const plantLocationName = normalizeNullableString(body.plant_location_name ?? body.plantLocationName);
        const isActive = normalizeNullableBooleanNumber(body.is_active ?? body.isActive);

        if (Number.isNaN(customerGroupId) || !customerGroupId) {
            return res.status(400).json({
                success: false,
                message: 'customer_group_id invalido',
            });
        }

        if (!plantLocationCode) {
            return res.status(400).json({
                success: false,
                message: 'plant_location_code es requerido',
            });
        }

        if (Number.isNaN(isActive)) {
            return res.status(400).json({
                success: false,
                message: 'is_active invalido',
            });
        }

        const plant = await insertCustomerGroupCrossPlant({
            customerGroupId,
            plantLocationCode,
            plantLocationName,
            isActive,
        });

        return res.status(201).json({
            success: true,
            data: plant,
        });
    } catch (error) {
        return next(error);
    }

};

export const editCustomerGroupCrossPlant = async (req, res, next) => {

    try {
        const id = normalizeNullableNumber(req.params?.id);
        const body = req.body || {};
        const customerGroupId = normalizeNullableNumber(body.customer_group_id ?? body.customerGroupId);
        const plantLocationCode = normalizeNullableString(body.plant_location_code ?? body.plantLocationCode);
        const plantLocationName = normalizeNullableString(body.plant_location_name ?? body.plantLocationName);
        const isActive = normalizeNullableBooleanNumber(body.is_active ?? body.isActive);

        if (Number.isNaN(id) || !id) {
            return res.status(400).json({
                success: false,
                message: 'id invalido',
            });
        }

        if (Number.isNaN(customerGroupId) || !customerGroupId) {
            return res.status(400).json({
                success: false,
                message: 'customer_group_id invalido',
            });
        }

        if (!plantLocationCode) {
            return res.status(400).json({
                success: false,
                message: 'plant_location_code es requerido',
            });
        }

        if (Number.isNaN(isActive)) {
            return res.status(400).json({
                success: false,
                message: 'is_active invalido',
            });
        }

        const plant = await updateCustomerGroupCrossPlant({
            id,
            customerGroupId,
            plantLocationCode,
            plantLocationName,
            isActive,
        });

        return res.json({
            success: true,
            data: plant,
        });
    } catch (error) {
        return next(error);
    }

};
