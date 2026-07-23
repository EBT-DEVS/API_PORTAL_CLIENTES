import cron from 'node-cron';

import env from '../config/env/env.config.js';
import { runNotificationsJob } from '../jobs/notifications/notifications.job.js';

const DEFAULT_NOTIFICATIONS_SCHEDULE = '*/5 * * * *';

let isRunning = false;

export const startNotificationsCron = () => {

    const timezone = env.cron.timezone || 'America/Chicago';
    const schedule = DEFAULT_NOTIFICATIONS_SCHEDULE;

    if (!cron.validate(schedule)) {
        throw new Error(`NOTIFICATIONS_CRON_SCHEDULE invalido: ${schedule}`);
    }

    cron.schedule(
        schedule,
        async () => {
            if (isRunning) {
                console.log('[cron] notifications omitido: ejecucion previa activa');
                return;
            }

            isRunning = true;

            try {
                await runNotificationsJob();
            } catch (error) {
                console.error('[cron] notifications error', error);
            } finally {
                isRunning = false;
            }
        },
        { timezone }
    );

    console.log(`[cron] notifications activo (${schedule}, ${timezone})`);

};
