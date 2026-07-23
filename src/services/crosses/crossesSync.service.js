import env from '../../config/env/env.config.js';
import { getCustomerGroupCrossPlantsExceptions } from '../../models/customer_group_cross_plants_exceptions/customer.group.cross.plants.exceptions.model.js';
import { getCustomerGroupCrossPlants } from '../../models/groups/customer.group.cross.plants.model.js';
import { getCustomerGroupCustomers } from '../../models/groups/customer.group.customers.js';
import { dedupeOrders, filterOrdersByCustomers, filterOrdersByPlantExceptions } from './crossesOrdersFilter.service.js';
import { fetchOrdersByCustomer, fetchOrdersByPlant } from './crossesMcleodOrders.service.js';

const summarizePlantResult = (result) => ({
    plantLocationCode: result.plantLocationCode,
    query: result.query,
    fetchedOrders: result.fetchedOrders,
});

const summarizeCustomerResult = (result) => ({
    customerCode: result.customerCode,
    query: result.query,
    fetchedOrders: result.fetchedOrders,
});

const tagOrdersSource = (orders = [], source) => (
    orders.map((order) => ({
        ...order,
        _crossSource: source,
    }))
);

export const syncCrossesOrdersFromMcleod = async ({
    company = env.cron.crossings.company || 'ebt',
    dateString = null,
    isActive = 1,
    lookbackHours = env.cron.crossings.lookbackHours,
    refetchAssignments = false,
} = {}) => {

    const [plants, customers, plantExceptions] = await Promise.all([
        getCustomerGroupCrossPlants(isActive),
        getCustomerGroupCustomers(isActive),
        getCustomerGroupCrossPlantsExceptions(isActive),
    ]);

    const plantResults = await Promise.all(
        plants.map((plant) => fetchOrdersByPlant({
            plant,
            company,
            dateString,
            lookbackHours,
        }))
    );
    const plantFetchedOrders = tagOrdersSource(
        plantResults.flatMap((result) => result.orders),
        'PLANT'
    );
    const uniquePlantOrders = dedupeOrders(plantFetchedOrders);
    const plantFilterResult = filterOrdersByCustomers({
        orders: uniquePlantOrders,
        customers,
    });
    const customerResults = await Promise.all(
        customers.map((customer) => fetchOrdersByCustomer({
            customer,
            company,
            dateString,
            lookbackHours,
        }))
    );
    const customerFetchedOrders = tagOrdersSource(
        customerResults.flatMap((result) => result.orders),
        'CUSTOMER'
    );
    const ordersBeforeFinalDedupe = [
        ...plantFilterResult.filteredOrders,
        ...customerFetchedOrders,
    ];
    const plantExceptionFilterResult = filterOrdersByPlantExceptions({
        orders: ordersBeforeFinalDedupe,
        customers,
        exceptions: plantExceptions,
    });
    const uniqueOrders = dedupeOrders(plantExceptionFilterResult.filteredOrders);
    const {
        customerCodes,
        filteredOrders,
        skippedOrders,
    } = filterOrdersByCustomers({
        orders: uniqueOrders,
        customers,
    });
    const fetchedOrdersCount = plantFetchedOrders.length + customerFetchedOrders.length;

    return {
        company,
        dateString,
        isActive,
        lookbackHours,
        refetchAssignments,
        plantsCount: plants.length,
        plantExceptionsCount: plantExceptions.length,
        customersCount: customers.length,
        customerCodes,
        exceptionPlantCodes: plantExceptionFilterResult.exceptionPlantCodes,
        plantQueries: plantResults.map(summarizePlantResult),
        customerQueries: customerResults.map(summarizeCustomerResult),
        plantFetchedOrdersCount: plantFetchedOrders.length,
        plantFilteredOrdersCount: plantFilterResult.filteredOrders.length,
        customerFetchedOrdersCount: customerFetchedOrders.length,
        fetchedOrdersCount,
        plantExceptionSkippedOrdersCount: plantExceptionFilterResult.skippedOrders.length,
        uniqueOrdersCount: uniqueOrders.length,
        duplicateOrdersCount: plantExceptionFilterResult.filteredOrders.length - uniqueOrders.length,
        filteredOrdersCount: filteredOrders.length,
        skippedOrdersCount: skippedOrders.length + plantExceptionFilterResult.skippedOrders.length,
        filteredOrders,
        skippedOrders: [
            ...plantExceptionFilterResult.skippedOrders,
            ...skippedOrders,
        ],
    };

};
