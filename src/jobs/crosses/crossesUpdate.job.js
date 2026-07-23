import { buildActiveCrossesUpdatePayloads } from '../../services/crosses/crossesUpdate.service.js';

let isRunning = false;

export const runCrossesUpdateJob = async (options = {}) => {

    if (isRunning) {
        return {
            ok: false,
            skipped: true,
            skipReason: 'previous_job_running',
        };
    }

    isRunning = true;

    try {
        console.log('[crosses-update-job] inicio', options);

        const result = await buildActiveCrossesUpdatePayloads(options);

        console.log('[crosses-update-job] actualizado', {
            activeCrosses: result.activeCrossesCount,
            matchedOrders: result.matchedOrdersCount,
            crosses: result.persistence.updatedCrossesCount,
            stops: result.persistence.updatedStopsCount,
            deletedStaleStops: result.persistence.deletedStaleStopsCount,
            assignments: result.persistence.upsertedAssignmentsCount,
        });

        return {
            ok: true,
            skipped: false,
            result,
        };
    } catch (error) {
        console.error('[crosses-update-job] error', {
            message: error.message,
        });

        throw error;
    } finally {
        isRunning = false;
    }

};
