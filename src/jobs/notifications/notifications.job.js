import { runPendingNotifications } from '../../services/notifications/notificationsCron.service.js';

export const runNotificationsJob = async () => {

    const result = await runPendingNotifications();
    const sentResults = result.results.filter((item) => item.dispatch?.status === 'SENT');

    console.log(`[notifications] procesadas=${result.total}`);

    sentResults.forEach((item) => {
        console.log('[notifications] enviada', {
            subscription_id: item.subscription_id,
            channel: item.dispatch.channel,
            destinatarios: item.dispatch.destinatarios,
        });
    });

    return result;

};
