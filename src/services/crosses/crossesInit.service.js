import env from '../../config/env/env.config.js';
import { buildCrossAssignmentsPayloadsFromOrders } from './crossesAssignmentsPayload.service.js';
import { buildCrossPayloadsFromOrders } from './crossesPayload.service.js';
import { buildCrossStopsPayloadsFromOrders } from './crossesStopsPayload.service.js';
import { persistInitialCrosses } from './crossesInitPersistence.service.js';
import { syncCrossesOrdersFromMcleod } from './crossesSync.service.js';

export const initializeCrossesFromMcleod = async ({
    company = env.cron.crossings.company || 'ebt',
    dateString = null,
    isActive = 1,
    lookbackHours = env.cron.crossings.lookbackHours,
    refetchAssignments = false,
    priorityId = 2,
} = {}) => {

    const ordersResult = await syncCrossesOrdersFromMcleod({
        company,
        dateString,
        isActive,
        lookbackHours,
        refetchAssignments,
    });
    const orders = ordersResult.filteredOrders || [];
    const stopsResult = await buildCrossStopsPayloadsFromOrders({
        orders,
        company,
    });
    const assignmentsResult = await buildCrossAssignmentsPayloadsFromOrders({
        orders,
        company,
        refetchAssignments,
    });
    const crossesResult = await buildCrossPayloadsFromOrders({
        orders,
        stopsPayloads: stopsResult.payloads || [],
        assignmentPayloads: assignmentsResult.payloads || [],
        priorityId,
        isActive,
    });
    const persistenceResult = await persistInitialCrosses({
        crossPayloads: crossesResult.payloads || [],
        stopsPayloads: stopsResult.payloads || [],
        assignmentPayloads: assignmentsResult.payloads || [],
    });

    return {
        ok: true,
        company,
        dateString,
        isActive,
        lookbackHours,
        refetchAssignments,
        priorityId,
        orders: {
            plantsCount: ordersResult.plantsCount,
            plantExceptionsCount: ordersResult.plantExceptionsCount,
            customersCount: ordersResult.customersCount,
            plantFetchedOrdersCount: ordersResult.plantFetchedOrdersCount,
            plantFilteredOrdersCount: ordersResult.plantFilteredOrdersCount,
            plantExceptionSkippedOrdersCount: ordersResult.plantExceptionSkippedOrdersCount,
            customerFetchedOrdersCount: ordersResult.customerFetchedOrdersCount,
            fetchedOrdersCount: ordersResult.fetchedOrdersCount,
            uniqueOrdersCount: ordersResult.uniqueOrdersCount,
            duplicateOrdersCount: ordersResult.duplicateOrdersCount,
            filteredOrdersCount: ordersResult.filteredOrdersCount,
            skippedOrdersCount: ordersResult.skippedOrdersCount,
            plantQueries: ordersResult.plantQueries,
            customerQueries: ordersResult.customerQueries,
        },
        payloads: {
            stopsCount: stopsResult.totalStopsCount,
            completeOrdersCount: stopsResult.completeOrdersCount,
            incompleteOrdersCount: stopsResult.incompleteOrdersCount,
            assignmentsCount: assignmentsResult.assignmentsCount,
            skippedAssignmentsCount: assignmentsResult.skippedAssignmentsCount,
            crossesCount: crossesResult.crossesCount,
            validCrossesCount: crossesResult.validCrossesCount,
            invalidCrossesCount: crossesResult.invalidCrossesCount,
            statusSummary: crossesResult.statusSummary,
        },
        persistence: persistenceResult,
    };

};
