import { startCrossesInitCron, startCrossesUpdateCron } from './crosses.cron.js';
import { startColombiaYardExitNotificationsCron } from './colombiaYardExitNotifications.cron.js';
import { startNotificationsCron } from './notifications.cron.js';
import env from '../config/env/env.config.js';

const isEnabled = (value) => (
    ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase())
);

const isProduction = () => (
    String(env.nodeEnv || '').trim().toLowerCase() === 'production'
);

export const startCronScheduler = () => {

    if (!isProduction()) {
        console.log(`[cron] deshabilitado para NODE_ENV=${env.nodeEnv || 'development'}`);
        return;
    }

    if (isEnabled(env.cron.crossings.enabled)) {
        startCrossesInitCron();
        startCrossesUpdateCron();
    } else {
        console.log('[cron] crossings sync deshabilitado');
    }

    if (isEnabled(env.cron.notifications.enabled)) {
        startNotificationsCron();
        startColombiaYardExitNotificationsCron();
    } else {
        console.log('[cron] notifications deshabilitado');
    }

};
