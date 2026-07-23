import { closeDbPool } from '../src/config/db/db.portal.config.js';
import { runCrossesUpdateJob } from '../src/jobs/crosses/crossesUpdate.job.js';

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
        refetchAssignments: getBooleanArg('refetchAssignments', true),
        priorityId: toOptionalNumber(getArgValue('priority-id', '2'), 2),
    };
    const jobResult = await runCrossesUpdateJob(options);

    if (jobResult.skipped) {
        console.log('[run-crosses-update] omitido', {
            reason: jobResult.skipReason,
        });
        return;
    }

    console.log('[run-crosses-update] terminado', {
        activeCrosses: jobResult.result.activeCrossesCount,
        fetchedOrders: jobResult.result.fetchedOrdersCount,
        matchedOrders: jobResult.result.matchedOrdersCount,
        skippedOrders: jobResult.result.skippedOrdersCount,
        updatedCrosses: jobResult.result.persistence.updatedCrossesCount,
        updatedStops: jobResult.result.persistence.updatedStopsCount,
        deletedStaleStops: jobResult.result.persistence.deletedStaleStopsCount,
        upsertedAssignments: jobResult.result.persistence.upsertedAssignmentsCount,
        skippedCrosses: jobResult.result.persistence.skippedCrossesCount,
        skippedStops: jobResult.result.persistence.skippedStopsCount,
        skippedAssignments: jobResult.result.persistence.skippedAssignmentsCount,
        statusSummary: jobResult.result.payloads.statusSummary,
    });

};

main()
    .catch((error) => {
        console.error('[run-crosses-update] error', {
            message: error.message,
            stack: error.stack,
        });

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await closeDbPool();
        } catch (error) {
            console.error('[run-crosses-update] error cerrando pool', {
                message: error.message,
            });
        }
    });
