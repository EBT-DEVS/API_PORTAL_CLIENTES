import env from '../../config/env/env.config.js';
import { getOrders } from '../../integrations/api_mcleod/mcleod.endpoints.js';

const MCLEOD_DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const AUTO_RANGE_START_DAYS_AGO = 1;
const AUTO_RANGE_END_DAYS_AHEAD = 6;

const pad = (value) => String(value).padStart(2, '0');

const toMcleodDate = (date) => (
    `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${String(date.getFullYear()).slice(-2)}`
);

export const buildMcleodDateFilter = ({ dateString = null, lookbackHours = env.cron.crossings.lookbackHours } = {}) => {

    if (dateString) {
        const match = String(dateString).trim().match(MCLEOD_DATE_FORMAT);

        if (!match) {
            throw new Error('dateString invalido. Usa formato YYYY-MM-DD');
        }

        const [, year, month, day] = match;
        return `${month}/${day}/${year.slice(-2)}`;
    }

    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    start.setDate(start.getDate() - AUTO_RANGE_START_DAYS_AGO);
    end.setDate(end.getDate() + AUTO_RANGE_END_DAYS_AHEAD);

    return `${toMcleodDate(start)}:${toMcleodDate(end)}`;

};

export const buildPlantOrdersQuery = ({ plantLocationCode, dateString = null, lookbackHours } = {}) => {

    if (!plantLocationCode) {
        throw new Error('plantLocationCode es requerido');
    }

    const params = new URLSearchParams({
        'shipper.location_id': String(plantLocationCode).trim(),
        'shipper.sched_arrive_early': buildMcleodDateFilter({
            dateString,
            lookbackHours,
        }),
    });

    return params.toString();

};

export const buildCustomerOrdersQuery = ({ customerCode, dateString = null, lookbackHours } = {}) => {

    if (!customerCode) {
        throw new Error('customerCode es requerido');
    }

    const params = new URLSearchParams({
        'customer.id': String(customerCode).trim(),
        'consignee.sched_arrive_early': buildMcleodDateFilter({
            dateString,
            lookbackHours,
        }),
    });

    return params.toString();

};

export const buildOrderByIdQuery = (orderId) => {

    if (!orderId) {
        throw new Error('orderId es requerido');
    }

    const params = new URLSearchParams({
        'orders.id': String(orderId).trim(),
    });

    return params.toString();

};

export const fetchOrdersByPlant = async ({
    plant,
    company = env.cron.crossings.company || 'ebt',
    dateString = null,
    lookbackHours,
} = {}) => {

    const plantLocationCode = plant?.plant_location_code || plant?.plantLocationCode || plant;
    const query = buildPlantOrdersQuery({
        plantLocationCode,
        dateString,
        lookbackHours,
    });
    const orders = await getOrders(query, company);

    return {
        plantLocationCode,
        query,
        fetchedOrders: orders.length,
        orders,
    };

};

export const fetchOrdersByCustomer = async ({
    customer,
    company = env.cron.crossings.company || 'ebt',
    dateString = null,
    lookbackHours,
} = {}) => {

    const customerCode = customer?.mcleod_customer_code || customer?.customerCode || customer;
    const query = buildCustomerOrdersQuery({
        customerCode,
        dateString,
        lookbackHours,
    });
    const orders = await getOrders(query, company);

    return {
        customerCode,
        query,
        fetchedOrders: orders.length,
        orders,
    };

};

export const fetchOrderById = async ({
    orderId,
    company = env.cron.crossings.company || 'ebt',
} = {}) => {

    const query = buildOrderByIdQuery(orderId);
    const orders = await getOrders(query, company);

    return {
        orderId,
        query,
        fetchedOrders: orders.length,
        orders,
    };

};
