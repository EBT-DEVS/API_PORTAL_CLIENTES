import pool from '../../config/db/db.portal.config.js';

const buildSpSql = (spName, params = []) => {

    const placeholders = params.length ? params.map(() => '?').join(', ') : '';

    return `CALL ${spName}(${placeholders})`;

};

const executeSpWithConnection = async (connection, spName, params = []) => {

    const [resultSets] = await connection.execute(buildSpSql(spName, params), params);

    return resultSets;

};

const getFirstResultSet = (resultSets = []) => (
    resultSets.find((resultSet) => Array.isArray(resultSet)) || []
);

const getFirstRow = (resultSets = []) => (
    getFirstResultSet(resultSets)[0] || null
);

const toJsonParam = (value) => JSON.stringify(value);

const padDatePart = (value) => String(value).padStart(2, '0');

const formatMysqlDateTime = (date) => (
    [
        date.getFullYear(),
        padDatePart(date.getMonth() + 1),
        padDatePart(date.getDate()),
    ].join('-')
    + ' '
    + [
        padDatePart(date.getHours()),
        padDatePart(date.getMinutes()),
        padDatePart(date.getSeconds()),
    ].join(':')
);

const addMinutesToCurrentDateTime = (minutes) => {

    const date = new Date(Date.now() + (minutes * 60000));

    return formatMysqlDateTime(date);

};

const getNotificationFrequencyById = async (connection, frequencyId) => {

    const resultSets = await executeSpWithConnection(
        connection,
        'sp_cat_notification_frequencies_get',
        [
            frequencyId,
            1,
        ]
    );

    return getFirstRow(resultSets);

};

const insertSubscription = async (connection, payload) => {

    const frequency = await getNotificationFrequencyById(
        connection,
        payload.notification_frequency_id
    );

    if (!frequency?.interval_minutes) {
        throw new Error('No se pudo resolver la frecuencia de notificacion');
    }

    const nextNotificationAt = addMinutesToCurrentDateTime(Number(frequency.interval_minutes));

    const resultSets = await executeSpWithConnection(connection, 'sp_notification_subscriptions_insert', [
        payload.customer_code,
        payload.customer_name,
        payload.notification_channel_id,
        payload.notification_frequency_id,
        payload.last_notification_at,
        nextNotificationAt,
        payload.is_active,
    ]);

    return getFirstRow(resultSets);

};

const insertCatalogRecipientIgnore = async (connection, recipient, subscription) => {

    const catalogRecipientPayload = {
        customer_code: recipient.customer_code ?? subscription.customer_code,
        notification_channel_id: recipient.notification_channel_id ?? subscription.notification_channel_id,
        recipient_value: recipient.recipient_value,
        is_active: recipient.is_active ?? 1,
    };
    const resultSets = await executeSpWithConnection(
        connection,
        'sp_cat_notification_recipients_insert_ignore',
        [toJsonParam(catalogRecipientPayload)]
    );

    return getFirstRow(resultSets);

};

const insertSubscriptionRecipientIgnore = async (connection, subscriptionId, recipientId) => {

    const resultSets = await executeSpWithConnection(
        connection,
        'sp_notification_subscription_recipients_insert_ignore',
        [
            toJsonParam({
                notification_subscription_id: subscriptionId,
                notification_recipient_id: recipientId,
            }),
        ]
    );

    return getFirstRow(resultSets);

};

const resolveRecipientId = async (connection, recipient, subscription) => {

    if (recipient.id) {
        return recipient.id;
    }

    const catalogRecipient = await insertCatalogRecipientIgnore(connection, recipient, subscription);

    if (!catalogRecipient?.id) {
        throw new Error('No se pudo resolver el destinatario de notificacion');
    }

    return catalogRecipient.id;

};

const insertSubscriptionRecipients = async (connection, subscription, recipients = []) => {

    const insertedRecipients = [];

    for (const recipient of recipients) {
        const recipientId = await resolveRecipientId(connection, recipient, subscription);
        const insertedRecipient = await insertSubscriptionRecipientIgnore(connection, subscription.id, recipientId);

        insertedRecipients.push(insertedRecipient);
    }

    return insertedRecipients;

};

const insertSubscriptionCrossingIgnore = async (connection, subscriptionId, crossingId) => {

    const resultSets = await executeSpWithConnection(
        connection,
        'sp_notification_subscription_crossings_insert_ignore',
        [
            toJsonParam({
                notification_subscription_id: subscriptionId,
                crossing_id: crossingId,
            }),
        ]
    );

    return getFirstRow(resultSets);

};

const insertSubscriptionCrossings = async (connection, subscriptionId, crossings = []) => {

    const insertedCrossings = [];

    for (const crossingId of crossings) {
        const insertedCrossing = await insertSubscriptionCrossingIgnore(connection, subscriptionId, crossingId);

        insertedCrossings.push(insertedCrossing);
    }

    return insertedCrossings;

};

export const createNotificationSubscription = async (payload) => {

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const subscription = await insertSubscription(connection, payload);

        if (!subscription?.id) {
            throw new Error('No se pudo crear la suscripcion de notificacion');
        }

        const recipients = await insertSubscriptionRecipients(
            connection,
            subscription,
            payload.recipients
        );
        const crossings = await insertSubscriptionCrossings(
            connection,
            subscription.id,
            payload.crossings
        );

        await connection.commit();

        return {
            subscription,
            recipients,
            crossings,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

};

export const getNotificationSubscriptions = async ({
    id = null,
    customerCode = null,
    channel = null,
    frequency = null,
    isActive = null,
} = {}) => {

    const connection = await pool.getConnection();

    try {
        const resultSets = await executeSpWithConnection(connection, 'sp_notification_subscriptions_get', [
            id,
            customerCode,
            channel,
            frequency,
            isActive,
        ]);

        return getFirstResultSet(resultSets);
    } finally {
        connection.release();
    }

};

export const deactivateNotificationSubscriptionById = async (id) => {

    const connection = await pool.getConnection();

    try {
        const resultSets = await executeSpWithConnection(connection, 'sp_notification_subscription_deactivate', [
            id,
        ]);

        return getFirstRow(resultSets);
    } finally {
        connection.release();
    }

};
