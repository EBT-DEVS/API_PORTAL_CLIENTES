import { startCrossesInitCron, startCrossesUpdateCron } from './crosses.cron.js';
import { startNotificationsCron } from './notifications.cron.js';
import env from '../config/env/env.config.js';

const isEnabled = (value) => (
    ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase())
);

export const startCronScheduler = () => {

    if (isEnabled(env.cron.crossings.enabled)) {
        startCrossesInitCron();
        startCrossesUpdateCron();
    } else {
        console.log('[cron] crossings sync deshabilitado');
    }

    if (isEnabled(env.cron.notifications.enabled)) {
        startNotificationsCron();
    } else {
        console.log('[cron] notifications deshabilitado');
    }

};
