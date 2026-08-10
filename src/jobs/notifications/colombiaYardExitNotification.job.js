import { runColombiaYardExitNotifications } from '../../services/notifications/colombiaYardExitNotification.service.js';

export const runColombiaYardExitNotificationJob = async () => {

    const result = await runColombiaYardExitNotifications();

    return result;

};
