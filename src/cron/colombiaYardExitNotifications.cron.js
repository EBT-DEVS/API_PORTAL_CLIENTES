import cron from 'node-cron';

import { runColombiaYardExitNotificationJob } from '../jobs/notifications/colombiaYardExitNotification.job.js';

const DEFAULT_SCHEDULE = '*/5 * * * *';
const TIMEZONE = 'America/Matamoros';

let isRunning = false;

export const startColombiaYardExitNotificationsCron = () => {

    const schedule = DEFAULT_SCHEDULE;

    if (!cron.validate(schedule)) {
        throw new Error(`COLOMBIA_YARD_EXIT_NOTIFICATIONS_CRON_SCHEDULE invalido: ${schedule}`);
    }

    cron.schedule(
        schedule,
        async () => {
            if (isRunning) {
                console.log('[cron] colombia yard exit notifications omitido: ejecucion previa activa');
                return;
            }

            isRunning = true;

            try {
                await runColombiaYardExitNotificationJob();
            } catch (error) {
                console.error('[cron] colombia yard exit notifications error', error);
            } finally {
                isRunning = false;
            }
        },
        { timezone: TIMEZONE }
    );

    console.log(`[cron] colombia yard exit notifications activo (${schedule}, ${TIMEZONE})`);

};
