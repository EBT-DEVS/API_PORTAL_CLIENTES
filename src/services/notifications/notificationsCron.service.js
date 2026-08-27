import { getCrossDetailById } from '../../models/crosses/crosses.model.js';
import { getTrailerData } from '../../models/db_gps/trailers.model.js';
import { getNotificationReasons } from '../../models/catalogs/notification.reasons.model.js';
import {
    deactivateNotificationSubscription,
    getActiveNotificationSubscriptions,
    markNotificationSubscriptionSent,
} from '../../models/notifications/notification.cron.model.js';
import { insertNotificationDispatchLog } from '../../models/notifications/notification.dispatch.logs.model.js';
import { dispatchNotificationByChannel } from './notificationChannelDispatcher.service.js';

const FINAL_CROSS_STATUS_IDS = new Set([12, 13]);
const TRACKING_REASON_CODE = 'TRACKING';
const TRACKING_EMAIL_SUBJECT = 'Tracking - EBT';

const parseJsonField = (value, fallback) => {

    if (value === undefined || value === null) {
        return fallback;
    }

    if (typeof value === 'object') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (_error) {
        return fallback;
    }

};

const isDueForNotification = (nextNotificationAt) => {

    if (!nextNotificationAt) {
        return true;
    }

    return new Date(nextNotificationAt).getTime() <= Date.now();

};

const normalizeActiveSubscription = (subscription) => ({
    ...subscription,
    notification_channel: parseJsonField(subscription.notification_channel, null),
    notification_frequency: parseJsonField(subscription.notification_frequency, null),
    recipients: parseJsonField(subscription.recipients, []),
    crossings: parseJsonField(subscription.crossings, []),
});

const getCrossingId = (crossing) => crossing?.crossing_id ?? crossing?.crossingId ?? crossing?.id ?? null;

const getSubscriptionCrossDetails = async (crossings = []) => {

    const crossDetails = [];

    for (const crossing of crossings) {
        const crossingId = getCrossingId(crossing);

        if (!crossingId) {
            continue;
        }

        const detail = await getCrossDetailById(crossingId);

        if (detail) {
            crossDetails.push(detail);
        }
    }

    return crossDetails;

};

const isFinalizedCross = (crossDetail) => (
    FINAL_CROSS_STATUS_IDS.has(Number(crossDetail?.cross?.cross_status_id))
);

const areAllCrossesFinalized = (crossDetails = []) => (
    crossDetails.length === 0 || crossDetails.every(isFinalizedCross)
);

const formatRecipients = (recipients = []) => (
    recipients
        .map((recipientRelation) => recipientRelation?.recipient || recipientRelation)
        .filter((recipient) => recipient?.recipient_value)
);

const formatCrosses = (crossDetails = []) => (
    crossDetails.map((detail) => ({
        cross: detail.cross,
        stops: detail.stops,
        equipment: detail.equipment,
        gps: detail.gps,
    }))
);

const resolveCustomerGroupId = (crossDetails = []) => (
    crossDetails
        .map((detail) => detail?.cross?.customer_group_id)
        .find((customerGroupId) => customerGroupId !== undefined && customerGroupId !== null)
    ?? null
);

const resolveNotificationChannelId = (subscription) => (
    subscription?.notification_channel?.id
    ?? subscription?.notification_channel_id
    ?? null
);

const resolveNotificationChannelCode = (subscription) => (
    subscription?.notification_channel?.code
    ?? subscription?.notification_channel_code
    ?? null
);

const resolveRecipientValues = (notification) => (
    notification.recipients
        .map((recipient) => recipient?.recipient_value)
        .filter(Boolean)
);

const getTrackingReason = async () => {

    const reasons = await getNotificationReasons({
        name: 'Tracking',
        isActive: 1,
    });

    return reasons.find((reason) => reason.code === TRACKING_REASON_CODE) || null;

};

const saveTrackingDispatchLog = async ({
    subscription,
    crossDetails,
    notification,
    status,
} = {}) => {

    const reason = await getTrackingReason();

    return insertNotificationDispatchLog({
        notification_reason_id: reason?.id || null,
        notification_channel_id: resolveNotificationChannelId(subscription),
        customer_group_id: resolveCustomerGroupId(crossDetails),
        entity_id: subscription.id,
        subject: TRACKING_EMAIL_SUBJECT,
        recipients_json: JSON.stringify(resolveRecipientValues(notification)),
        status,
        sent_at: new Date(),
    });

};

const enrichCrossDetailsWithGps = async (crossDetails = []) => {

    const enrichedCrosses = [];

    for (const detail of crossDetails) {
        const trailerId = detail?.cross?.trailer_id;
        let gps = detail?.gps || null;

        if (trailerId) {
            try {
                gps = await getTrailerData(trailerId);
            } catch (error) {
                gps = {
                    error: error.message,
                };
            }
        }

        enrichedCrosses.push({
            ...detail,
            gps,
        });
    }

    return enrichedCrosses;

};

const formatNotificationForChannel = (subscription, crossDetails) => ({
    subscription: {
        id: subscription.id,
        customer_code: subscription.customer_code,
        customer_name: subscription.customer_name,
        last_notification_at: subscription.last_notification_at,
        next_notification_at: subscription.next_notification_at,
    },
    channel: subscription.notification_channel,
    frequency: subscription.notification_frequency,
    recipients: formatRecipients(subscription.recipients),
    crossings: formatCrosses(crossDetails),
});

const processSubscription = async (subscription) => {

    const crossDetails = await getSubscriptionCrossDetails(subscription.crossings);

    if (areAllCrossesFinalized(crossDetails)) {
        const deactivated = await deactivateNotificationSubscription(subscription.id);

        return {
            subscription_id: subscription.id,
            status: 'DEACTIVATED',
            deactivated,
        };
    }

    if (!isDueForNotification(subscription.next_notification_at)) {
        return {
            subscription_id: subscription.id,
            status: 'NOT_DUE',
        };
    }

    const enrichedCrossDetails = await enrichCrossDetailsWithGps(crossDetails);
    const notification = formatNotificationForChannel(subscription, enrichedCrossDetails);
    let dispatchResult = null;

    try {
        dispatchResult = await dispatchNotificationByChannel(notification);
    } catch (error) {
        const log = await saveTrackingDispatchLog({
            subscription,
            crossDetails: enrichedCrossDetails,
            notification,
            status: 'FAILED',
        });

        return {
            subscription_id: subscription.id,
            status: 'ERROR',
            error: error.message,
            log,
        };
    }

    const shouldLogDispatch = ['SENT', 'SKIPPED'].includes(dispatchResult.status);
    const log = shouldLogDispatch
        ? await saveTrackingDispatchLog({
            subscription,
            crossDetails: enrichedCrossDetails,
            notification,
            status: dispatchResult.status,
        })
        : null;

    if (dispatchResult.status === 'SENT') {
        await markNotificationSubscriptionSent(subscription.id);
    }

    return {
        subscription_id: subscription.id,
        status: 'DISPATCHED_TO_CHANNEL',
        notification_reason_code: TRACKING_REASON_CODE,
        notification_channel_code: resolveNotificationChannelCode(subscription),
        dispatch: dispatchResult,
        log,
    };

};

export const runPendingNotifications = async () => {

    const subscriptions = (await getActiveNotificationSubscriptions())
        .map(normalizeActiveSubscription);
    const results = [];

    for (const subscription of subscriptions) {
        try {
            const result = await processSubscription(subscription);

            results.push(result);
        } catch (error) {
            results.push({
                subscription_id: subscription.id,
                status: 'ERROR',
                error: error.message,
            });
        }
    }

    return {
        total: subscriptions.length,
        results,
    };

};
