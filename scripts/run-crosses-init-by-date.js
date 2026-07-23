import { closeDbPool } from '../src/config/db/db.portal.config.js';
import { runCrossesInitJob } from '../src/jobs/crosses/crossesInit.job.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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

    const dateString = getArgValue('date-string', null);

    if (!dateString || !datePattern.test(dateString)) {
        throw new Error('Debes mandar --date-string=YYYY-MM-DD');
    }

    const options = {
        company: getArgValue('company', process.env.CROSSINGS_MCLEOD_COMPANY || 'ebt'),
        dateString,
        isActive: toOptionalNumber(getArgValue('is-active', '1'), 1),
        refetchAssignments: getBooleanArg('refetchAssignments', false),
        priorityId: toOptionalNumber(getArgValue('priority-id', '2'), 2),
    };
    const debug = getBooleanArg('debug', false);
    const jobResult = await runCrossesInitJob(options);

    if (jobResult.skipped) {
        console.log('[run-crosses-init-by-date] omitido', {
            reason: jobResult.skipReason,
        });
        return;
    }

    console.log('[run-crosses-init-by-date] terminado', {
        dateString,
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
        console.log('[run-crosses-init-by-date] consultas McLeod', {
            plantsCount: jobResult.result.orders.plantsCount,
            customersCount: jobResult.result.orders.customersCount,
            plantQueries: jobResult.result.orders.plantQueries,
            customerQueries: jobResult.result.orders.customerQueries,
        });
    }

};

main()
    .catch((error) => {
        console.error('[run-crosses-init-by-date] error', {
            message: error.message,
            stack: error.stack,
        });

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await closeDbPool();
        } catch (error) {
            console.error('[run-crosses-init-by-date] error cerrando pool', {
                message: error.message,
            });
        }
    });
