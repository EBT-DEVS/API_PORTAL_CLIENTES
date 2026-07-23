const normalizeCode = (value) => (
    value == null ? null : String(value).trim().toUpperCase()
);

const getOrderCustomerCode = (order) => normalizeCode(
    order?.customer_id
    ?? order?.customerId
    ?? order?.customer?.id
    ?? order?.customer?.customer_id
    ?? order?.ordered_by_id
);

const getOrderId = (order) => (
    order?.id
    ?? order?.order_id
    ?? order?.mcleod_order_id
    ?? order?.order_number
    ?? order?.blnum
    ?? null
);

const normalizeArray = (value) => {

    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];

};

const getOrderStops = (order) => normalizeArray(order?.stops);

const getStopLocationCode = (stop) => normalizeCode(
    stop?.location_id
    ?? stop?.locationId
    ?? stop?.stop_code
    ?? stop?.code
);

export const buildCustomerCodeSet = (customers = []) => (
    new Set(
        customers
            .map((customer) => normalizeCode(customer.mcleod_customer_code))
            .filter(Boolean)
    )
);

export const filterOrdersByCustomers = ({ orders = [], customers = [] } = {}) => {

    const customerCodes = buildCustomerCodeSet(customers);
    const filteredOrders = [];
    const skippedOrders = [];

    for (const order of orders) {
        const customerCode = getOrderCustomerCode(order);

        if (customerCode && customerCodes.has(customerCode)) {
            filteredOrders.push({
                ...order,
                _crossFilter: {
                    customerCode,
                    matchedCustomer: true,
                },
            });
            continue;
        }

        skippedOrders.push({
            orderId: getOrderId(order),
            customerCode,
            skipReason: customerCode ? 'customer_not_in_group' : 'missing_customer_id',
        });
    }

    return {
        customerCodes: [...customerCodes],
        filteredOrders,
        skippedOrders,
    };

};

const buildCustomerGroupIdByCustomerCode = (customers = []) => (
    customers.reduce((map, customer) => {
        const customerCode = normalizeCode(customer.mcleod_customer_code);
        const customerGroupId = customer.customer_group_id;

        if (customerCode && customerGroupId != null) {
            map.set(customerCode, String(customerGroupId));
        }

        return map;
    }, new Map())
);

const buildExceptionCodesByCustomerGroupId = (exceptions = []) => (
    exceptions.reduce((map, exception) => {
        const customerGroupId = exception.customer_group_id;
        const plantLocationCode = normalizeCode(exception.plant_location_code);

        if (customerGroupId == null || !plantLocationCode) {
            return map;
        }

        const key = String(customerGroupId);
        const codes = map.get(key) || new Set();

        codes.add(plantLocationCode);
        map.set(key, codes);

        return map;
    }, new Map())
);

export const filterOrdersByPlantExceptions = ({
    orders = [],
    customers = [],
    exceptions = [],
} = {}) => {

    const customerGroupIdByCustomerCode = buildCustomerGroupIdByCustomerCode(customers);
    const exceptionCodesByCustomerGroupId = buildExceptionCodesByCustomerGroupId(exceptions);
    const filteredOrders = [];
    const skippedOrders = [];

    for (const order of orders) {
        const customerCode = getOrderCustomerCode(order);
        const customerGroupId = customerCode ? customerGroupIdByCustomerCode.get(customerCode) : null;
        const exceptionCodes = customerGroupId ? exceptionCodesByCustomerGroupId.get(customerGroupId) : null;

        if (!exceptionCodes?.size) {
            filteredOrders.push(order);
            continue;
        }

        const matchedStopCode = getOrderStops(order)
            .map(getStopLocationCode)
            .find((stopLocationCode) => stopLocationCode && exceptionCodes.has(stopLocationCode));

        if (!matchedStopCode) {
            filteredOrders.push(order);
            continue;
        }

        skippedOrders.push({
            orderId: getOrderId(order),
            customerCode,
            customerGroupId,
            plantLocationCode: matchedStopCode,
            skipReason: 'plant_exception_stop',
        });
    }

    return {
        filteredOrders,
        skippedOrders,
        exceptionPlantCodes: [
            ...new Set(
                exceptions
                    .map((exception) => normalizeCode(exception.plant_location_code))
                    .filter(Boolean)
            ),
        ],
    };

};

export const dedupeOrders = (orders = []) => {

    const seen = new Set();
    const deduped = [];

    for (const order of orders) {
        const orderId = getOrderId(order);
        const key = orderId ? `id:${orderId}` : JSON.stringify(order);

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        deduped.push(order);
    }

    return deduped;

};
