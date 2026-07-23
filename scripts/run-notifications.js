import { closeDbPool } from '../src/config/db/db.portal.config.js';
import { runNotificationsJob } from '../src/jobs/notifications/notifications.job.js';

const summarizeByStatus = (results = []) => (
    results.reduce((summary, result) => {
        const status = result.status || 'UNKNOWN';

        summary[status] = (summary[status] || 0) + 1;

        return summary;
    }, {})
);

const main = async () => {

    const jobResult = await runNotificationsJob();

    console.log('[run-notifications] terminado', {
        total: jobResult.total,
        statusSummary: summarizeByStatus(jobResult.results),
        results: jobResult.results.map((result) => ({
            subscription_id: result.subscription_id,
            status: result.status,
            channel: result.dispatch?.channel,
            dispatchStatus: result.dispatch?.status,
            recipientsCount: result.dispatch?.destinatarios?.length,
            reason: result.dispatch?.reason,
            error: result.error,
        })),
    });

};

main()
    .catch((error) => {
        console.error('[run-notifications] error', {
            message: error.message,
            stack: error.stack,
        });

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await closeDbPool();
        } catch (error) {
            console.error('[run-notifications] error cerrando pool', {
                message: error.message,
            });
        }
    });
