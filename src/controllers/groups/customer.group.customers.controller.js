import {
    getCustomerGroupCustomers,
    insertCustomerGroupCustomer,
    updateCustomerGroupCustomer,
} from '../../models/groups/customer.group.customers.js';

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

export const getCustomerGroupCustomersData = async (req, res, next) => {

    try {
        const id = normalizeNullableNumber(req.query?.id);
        const customerGroupId = normalizeNullableNumber(req.query?.customer_group_id ?? req.query?.customerGroupId);
        const customerName = normalizeNullableString(req.query?.customer_name ?? req.query?.customerName);
        const isActive = normalizeNullableBooleanNumber(req.query?.is_active ?? req.query?.isActive);

        if (Number.isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'id invalido',
            });
        }

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

        const customers = await getCustomerGroupCustomers({
            id,
            customerGroupId,
            customerName,
            isActive,
        });

        return res.json({
            success: true,
            data: customers,
        });
    } catch (error) {
        return next(error);
    }

};

export const createCustomerGroupCustomer = async (req, res, next) => {

    try {
        const body = req.body || {};
        const customerGroupId = normalizeNullableNumber(body.customer_group_id ?? body.customerGroupId);
        const mcleodCustomerCode = normalizeNullableString(body.mcleod_customer_code ?? body.mcleodCustomerCode);
        const mcleodCustomerName = normalizeNullableString(body.mcleod_customer_name ?? body.mcleodCustomerName);
        const isActive = normalizeNullableBooleanNumber(body.is_active ?? body.isActive);

        if (Number.isNaN(customerGroupId) || !customerGroupId) {
            return res.status(400).json({
                success: false,
                message: 'customer_group_id invalido',
            });
        }

        if (!mcleodCustomerCode) {
            return res.status(400).json({
                success: false,
                message: 'mcleod_customer_code es requerido',
            });
        }

        if (Number.isNaN(isActive)) {
            return res.status(400).json({
                success: false,
                message: 'is_active invalido',
            });
        }

        const customer = await insertCustomerGroupCustomer({
            customerGroupId,
            mcleodCustomerCode,
            mcleodCustomerName,
            isActive,
        });

        return res.status(201).json({
            success: true,
            data: customer,
        });
    } catch (error) {
        return next(error);
    }

};

export const editCustomerGroupCustomer = async (req, res, next) => {

    try {
        const id = normalizeNullableNumber(req.params?.id);
        const body = req.body || {};
        const customerGroupId = normalizeNullableNumber(body.customer_group_id ?? body.customerGroupId);
        const mcleodCustomerCode = normalizeNullableString(body.mcleod_customer_code ?? body.mcleodCustomerCode);
        const mcleodCustomerName = normalizeNullableString(body.mcleod_customer_name ?? body.mcleodCustomerName);
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

        if (!mcleodCustomerCode) {
            return res.status(400).json({
                success: false,
                message: 'mcleod_customer_code es requerido',
            });
        }

        if (Number.isNaN(isActive)) {
            return res.status(400).json({
                success: false,
                message: 'is_active invalido',
            });
        }

        const customer = await updateCustomerGroupCustomer({
            id,
            customerGroupId,
            mcleodCustomerCode,
            mcleodCustomerName,
            isActive,
        });

        return res.json({
            success: true,
            data: customer,
        });
    } catch (error) {
        return next(error);
    }

};
