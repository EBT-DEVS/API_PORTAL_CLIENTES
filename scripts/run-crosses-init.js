import { closeDbPool } from '../src/config/db/db.portal.config.js';
import { runCrossesInitJob } from '../src/jobs/crosses/crossesInit.job.js';
import { buildMcleodDateFilter } from '../src/services/crosses/crossesMcleodOrders.service.js';

const getArgValue = (name, fallback = null) => {

    const prefix = `--${name}=`;
    const arg = process.argv.find((item) => item.startsWith(prefix));

    return arg ? arg.slice(prefix.length) : fallback;

};

const getBooleanArg = (name, fallback = false) => {

    const rawValue = getArgValue(name, null);

    if (rawValue === null) {
        return fallback;
    }

    return ['1', 'true', 'yes', 'y'].includes(String(rawValue).trim().toLowerCase());

};

const toOptionalNumber = (value, fallback) => {

    if (value == null || value === '') {
        return fallback;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;

};

const main = async () => {

    const options = {
        company: getArgValue('company', process.env.CROSSINGS_MCLEOD_COMPANY || 'ebt'),
        isActive: toOptionalNumber(getArgValue('is-active', '1'), 1),
        lookbackHours: toOptionalNumber(getArgValue('lookback-hours', process.env.CROSSINGS_LOOKBACK_HOURS), undefined),
        refetchAssignments: getBooleanArg('refetchAssignments', false),
        priorityId: toOptionalNumber(getArgValue('priority-id', '2'), 2),
    };
    const debug = getBooleanArg('debug', false);
    const jobResult = await runCrossesInitJob(options);

    if (jobResult.skipped) {
        console.log('[run-crosses-init] omitido', {
            reason: jobResult.skipReason,
        });
        return;
    }

    console.log('[run-crosses-init] terminado', {
        dateFilter: buildMcleodDateFilter({
            lookbackHours: options.lookbackHours,
        }),
        fetchedOrders: jobResult.result.orders.fetchedOrdersCount,
        plantFetchedOrders: jobResult.result.orders.plantFetchedOrdersCount,
        customerFetchedOrders: jobResult.result.orders.customerFetchedOrdersCount,
        plantExceptionSkippedOrders: jobResult.result.orders.plantExceptionSkippedOrdersCount,
        duplicateOrders: jobResult.result.orders.duplicateOrdersCount,
        filteredOrders: jobResult.result.orders.filteredOrdersCount,
        insertedCrosses: jobResult.result.persistence.persistedCrossesCount,
        insertedStops: jobResult.result.persistence.persistedStopsCount,
        insertedAssignments: jobResult.result.persistence.persistedAssignmentsCount,
        skippedCrosses: jobResult.result.persistence.skippedCrossesCount,
        skippedStops: jobResult.result.persistence.skippedStopsCount,
        skippedAssignments: jobResult.result.persistence.skippedAssignmentsCount,
    });

    if (debug || jobResult.result.orders.fetchedOrdersCount === 0) {
        console.log('[run-crosses-init] consultas McLeod', {
            plantsCount: jobResult.result.orders.plantsCount,
            plantExceptionsCount: jobResult.result.orders.plantExceptionsCount,
            customersCount: jobResult.result.orders.customersCount,
            plantQueries: jobResult.result.orders.plantQueries,
            customerQueries: jobResult.result.orders.customerQueries,
        });
    }

};

main()
    .catch((error) => {
        console.error('[run-crosses-init] error', {
            message: error.message,
            stack: error.stack,
        });

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await closeDbPool();
        } catch (error) {
            console.error('[run-crosses-init] error cerrando pool', {
                message: error.message,
            });
        }
    });
