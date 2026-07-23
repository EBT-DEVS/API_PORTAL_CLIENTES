import { initializeCrossesFromMcleod } from '../../services/crosses/crossesInit.service.js';

let isRunning = false;

export const runCrossesInitJob = async (options = {}) => {

    if (isRunning) {
        return {
            ok: false,
            skipped: true,
            skipReason: 'previous_job_running',
        };
    }

    isRunning = true;

    try {
        console.log('[crosses-init-job] inicio', options);

        const result = await initializeCrossesFromMcleod(options);

        console.log('[crosses-init-job] insertados', {
            crosses: result.persistence.persistedCrossesCount,
            stops: result.persistence.persistedStopsCount,
            assignments: result.persistence.persistedAssignmentsCount,
        });

        return {
            ok: true,
            skipped: false,
            result,
        };
    } catch (error) {
        console.error('[crosses-init-job] error', {
            message: error.message,
        });

        throw error;
    } finally {
        isRunning = false;
    }

};
