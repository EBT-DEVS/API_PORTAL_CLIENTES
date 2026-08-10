import { closeDbPool } from '../src/config/db/db.portal.config.js';
import { runColombiaYardExitNotificationJob } from '../src/jobs/notifications/colombiaYardExitNotification.job.js';

const main = async () => {

    const result = await runColombiaYardExitNotificationJob();

    console.log('[run-colombia-yard-exit-notifications] terminado', {
        pending: result.pendingCount,
        sent: result.sentCount,
        skipped: result.skippedCount,
        errors: result.errorCount || 0,
    });

};

main()
    .catch((error) => {
        console.error('[run-colombia-yard-exit-notifications] error', {
            message: error.message,
            stack: error.stack,
        });

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await closeDbPool();
        } catch (error) {
            console.error('[run-colombia-yard-exit-notifications] error cerrando pool', {
                message: error.message,
            });
        }
    });
