import { runColombiaYardExitNotifications } from '../../services/notifications/colombiaYardExitNotification.service.js';

export const runColombiaYardExitNotificationJob = async () => {

    const result = await runColombiaYardExitNotifications();

    console.log('[colombia-yard-exit-notifications] terminado', {
        pending: result.pendingCount,
        sent: result.sentCount,
        skipped: result.skippedCount,
        errors: result.errorCount || 0,
    });

    return result;

};
