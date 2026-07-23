import { syncCrossesOrdersFromMcleod } from '../../services/crosses/crossesSync.service.js';

let isRunning = false;

export const runCrossesJob = async (options = {}) => {

    if (isRunning) {
        return {
            ok: false,
            skipped: true,
            skipReason: 'previous_job_running',
        };
    }

    isRunning = true;

    try {
        console.log('[crosses-job] inicio', options);

        const result = await syncCrossesOrdersFromMcleod(options);

        console.log('[crosses-job] fin', {
            fetchedOrdersCount: result.fetchedOrdersCount,
            filteredOrdersCount: result.filteredOrdersCount,
            skippedOrdersCount: result.skippedOrdersCount,
        });

        return {
            ok: true,
            skipped: false,
            result,
        };
    } catch (error) {
        console.error('[crosses-job] error', {
            message: error.message,
        });

        throw error;
    } finally {
        isRunning = false;
    }

};
