import { getTrailerData } from '../../models/db_gps/trailers.model.js';
import { getCrossDetailById } from '../../models/crosses/crosses.model.js';
import { updateCrossStopEta } from '../../models/crosses/crosses.stops.model.js';
import {
    clearColombiaYardStopDeparture,
    getColombiaYardGeofenceEventCandidates,
    getEbtColombiaGeofenceEvents,
    getTkGeofenceEvents,
    updateColombiaOriginStopDeparture,
    updateColombiaYardStopDeparture,
    updateColombiaYardStopArrival,
} from '../../models/notifications/colombia.yard.exit.notifications.model.js';
import { insertNotificationDispatchLog } from '../../models/notifications/notification.dispatch.logs.model.js';
import { getNotificationReasonRecipients } from '../../models/notifications/notification.reason.recipients.model.js';
import { enrichActiveStopEtaFromPcMiller } from '../crosses/crossesPcMillerEta.service.js';
import { sendEmail } from './notificationChannelDispatcher.service.js';

const buildEmailSubject = (item) => `Caja ${item?.trailer_id || 'sin caja'} en inicio de aduana`;
const NOTIFICATION_REASON_CODE = 'COLOMBIA_YARD_EXIT';
const NOTIFICATION_CHANNEL_CODE = 'EMAIL';
const COLOMBIA_YARD_TIME_ZONE = 'America/Matamoros';
const EBT_COLOMBIA_GEOFENCE_SOURCE = 'GPS_GEOFENCE';
const MEXICAN_CUSTOMS_NOTIFICATION_GEOFENCES = [
    'Aduana 240, Mex',
    'ADUANA MEXICANA COLOMBIA',
    'Inicio Aduana Mexicana Colombia',
    'Inicio Aduana 240 MEX',
];
const GEOFENCE_EVENT_WINDOW_PAST_MS = 60 * 60 * 1000;
const GEOFENCE_EVENT_WINDOW_FUTURE_MS = 60 * 60 * 1000;
const CUSTOMS_NOTIFICATION_WINDOW_PAST_MS = 30 * 60 * 1000;
const CUSTOMS_NOTIFICATION_WINDOW_FUTURE_MS = 30 * 60 * 1000;

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

const hasValue = (value) => (
    value !== undefined && value !== null && value !== ''
);

const isMcleodSource = (source) => (
    String(source || 'MCLEOD').trim().toUpperCase() === 'MCLEOD'
);

const formatNaiveDateTime = (value) => {

    const match = String(value).trim().match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (!match) {
        return null;
    }

    const [, year, month, day, hour = '00', minute = '00'] = match;

    return `${day}/${month}/${year}, ${hour}:${minute}`;

};

const formatDateTimeParts = ({
    year,
    month,
    day,
    hour,
    minute,
}) => (
    `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
);

const getTimeZoneDateTimeParts = (value, timeZone = COLOMBIA_YARD_TIME_ZONE) => {

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        })
            .formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value])
    );

};

const toTimeZoneSqlDateTime = (value = new Date(), timeZone = COLOMBIA_YARD_TIME_ZONE) => {

    const parts = getTimeZoneDateTimeParts(value, timeZone);

    if (!parts) {
        return null;
    }

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;

};

const toUtcSqlDateTime = (value = new Date()) => {

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const pad = (part) => String(part).padStart(2, '0');

    return [
        date.getUTCFullYear(),
        pad(date.getUTCMonth() + 1),
        pad(date.getUTCDate()),
    ].join('-') + ' ' + [
        pad(date.getUTCHours()),
        pad(date.getUTCMinutes()),
        pad(date.getUTCSeconds()),
    ].join(':');

};

const toLocalSqlDateTime = (value) => {

    if (!value) {
        return null;
    }

    if (!(value instanceof Date)) {
        const normalized = String(value).trim().replace('T', ' ').slice(0, 19);

        return normalized || null;
    }

    if (Number.isNaN(value.getTime())) {
        return null;
    }

    const pad = (part) => String(part).padStart(2, '0');

    return [
        value.getFullYear(),
        pad(value.getMonth() + 1),
        pad(value.getDate()),
    ].join('-') + ' ' + [
        pad(value.getHours()),
        pad(value.getMinutes()),
        pad(value.getSeconds()),
    ].join(':');

};

const toDateOrNull = (value) => {

    if (!hasValue(value)) {
        return null;
    }

    const date = value instanceof Date
        ? value
        : new Date(String(value).replace(' ', 'T'));

    return Number.isNaN(date.getTime()) ? null : date;

};

const toUtcStoredDateOrNull = (value) => {

    if (!hasValue(value)) {
        return null;
    }

    if (value instanceof Date) {
        return new Date(Date.UTC(
            value.getFullYear(),
            value.getMonth(),
            value.getDate(),
            value.getHours(),
            value.getMinutes(),
            value.getSeconds(),
        ));
    }

    const match = String(value).trim().match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
    );

    if (!match) {
        return null;
    }

    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    const date = new Date(Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
    ));

    return Number.isNaN(date.getTime()) ? null : date;

};

const formatDateTime = (value, { preserveDateObjectTime = false } = {}) => {

    if (!value) {
        return 'Sin fecha';
    }

    if (!(value instanceof Date)) {
        const naiveDateTime = formatNaiveDateTime(value);

        if (naiveDateTime) {
            return naiveDateTime;
        }
    }

    const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    if (preserveDateObjectTime && value instanceof Date) {
        return formatDateTimeParts({
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            hour: date.getHours(),
            minute: date.getMinutes(),
        });
    }

    return date.toLocaleString('es-MX', {
        timeZone: COLOMBIA_YARD_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

};

const toNumberOrNull = (value) => {

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;

};

const isValidLatitude = (value) => (
    Number.isFinite(value) && value >= -90 && value <= 90
);

const isValidLongitude = (value) => (
    Number.isFinite(value) && value >= -180 && value <= 180
);

const normalizeCoordinates = ({ latitude, longitude }) => {

    if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
        return {
            latitude,
            longitude,
        };
    }

    if (isValidLatitude(longitude) && isValidLongitude(latitude)) {
        return {
            latitude: longitude,
            longitude: latitude,
        };
    }

    return {
        latitude,
        longitude,
    };

};

const resolveGpsCoordinates = (gps) => normalizeCoordinates({
    latitude: toNumberOrNull(firstValue(
        gps?.latitude,
        gps?.lat,
        gps?.Latitud,
        gps?.latitud,
    )),
    longitude: toNumberOrNull(firstValue(
        gps?.longitude,
        gps?.lng,
        gps?.lon,
        gps?.Longitud,
        gps?.longitud,
    )),
});

const hasGpsCoordinates = (gps) => {

    const coordinates = resolveGpsCoordinates(gps);

    return isValidLatitude(coordinates.latitude) && isValidLongitude(coordinates.longitude);

};

const resolveGpsDateTime = (gps) => firstValue(
    gps?.position_date,
    gps?.positionDate,
    gps?.created_at,
    gps?.createdAt,
);

const isMexicanCustomsGeofence = (geofence) => (
    geofence?.stop_code === 'MX_CUSTOMS'
    && ['ADUANA 240, MEX', 'ADUANA MEXICANA COLOMBIA'].includes(String(geofence?.name || '').trim().toUpperCase())
);

const buildEtaStops = (destinationStop) => [
    {
        sequence: 1,
        actual_departure: toTimeZoneSqlDateTime(),
        latitude: destinationStop.destination_latitude,
        longitude: destinationStop.destination_longitude,
    },
    {
        sequence: 2,
        actual_arrival: null,
        actual_departure: null,
        latitude: toNumberOrNull(destinationStop.destination_latitude),
        longitude: toNumberOrNull(destinationStop.destination_longitude),
    },
];

const calculateEtaToDestinationStop = async ({ item, gps }) => {

    if (!item.destination_stop_id) {
        return {
            eta: null,
            skippedReason: 'missing_destination_stop',
        };
    }

    const result = await enrichActiveStopEtaFromPcMiller({
        gps,
        stops: buildEtaStops(item),
    });

    return {
        eta: result.activeStopEta?.eta || null,
        skippedReason: result.skippedReason,
        pcMiller: result.activeStopEta || null,
    };

};

const recalculateAndPersistNextStopEta = async ({ crossId, trailerId }) => {

    const detail = await getCrossDetailById(crossId);
    const stops = detail?.stops || [];

    if (!stops.length) {
        return {
            updated: false,
            skippedReason: 'missing_stops',
        };
    }

    const gps = trailerId ? await getTrailerData(trailerId) : null;
    const etaResult = await enrichActiveStopEtaFromPcMiller({
        stops,
        gps,
    });
    const activeStopEta = etaResult.activeStopEta;

    if (!activeStopEta?.eta) {
        return {
            updated: false,
            skippedReason: etaResult.skippedReason || 'missing_eta',
            activeStopSequence: etaResult.activeStopSequence || null,
        };
    }

    const activeStop = (etaResult.stops || []).find((stop) => (
        Number(stop.sequence) === Number(activeStopEta.activeStopSequence)
    ));

    if (!activeStop?.id) {
        return {
            updated: false,
            skippedReason: 'active_stop_id_not_found',
            activeStopEta,
        };
    }

    const persisted = await updateCrossStopEta({
        cross_stop_id: activeStop.id,
        eta: activeStopEta.eta,
    });

    return {
        updated: true,
        activeStopEta,
        stop: persisted,
    };

};

const resolveNotificationEventLabel = (item) => (
    item?._trigger_source === 'MEXICAN_CUSTOMS_START_GEOFENCE_ENTRY'
        ? 'Entrada a inicio de aduana'
        : 'Salida'
);

const buildEmailHtml = ({ item, gps, etaResult }) => `
    <div style="font-family: Arial, sans-serif; padding: 16px; color: #1f2933;">
        <h2 style="margin: 0 0 12px; color: #1f2933;">Caja en inicio de Aduana Mexicana Colombia</h2>
        <table cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tbody>
                <tr>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">Caja</td>
                    <td style="border: 1px solid #d9e2ec; padding: 8px;">${escapeHtml(item.trailer_id)}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">Orden</td>
                    <td style="border: 1px solid #d9e2ec; padding: 8px;">${escapeHtml(item.mcleod_order_id)}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">PO</td>
                    <td style="border: 1px solid #d9e2ec; padding: 8px;">${escapeHtml(item.po_number || 'Sin PO')}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">Planta inicial</td>
                    <td style="border: 1px solid #d9e2ec; padding: 8px;">${escapeHtml(firstValue(item.origin_stop_name, item.origin_stop_code, 'Sin planta'))}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">Patio</td>
                    <td style="border: 1px solid #d9e2ec; padding: 8px;">${escapeHtml(item.yard_name)}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">${escapeHtml(resolveNotificationEventLabel(item))}</td>
                    <td style="border: 1px solid #d9e2ec; padding: 8px;">${escapeHtml(formatDateTime(item.exit_at, { preserveDateObjectTime: true }))}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">Destino</td>
                    <td style="border: 1px solid #d9e2ec; padding: 8px;">${escapeHtml(firstValue(item.destination_stop_name, item.destination_stop_code, 'Sin destino'))}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">ETA</td>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; color: #b45309; font-weight: bold;">${escapeHtml(etaResult.eta ? formatDateTime(etaResult.eta) : 'No disponible')}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">Ubicacion GPS</td>
                    <td style="border: 1px solid #d9e2ec; padding: 8px;">${escapeHtml(gps?.location || gps?.ubicacion || 'Sin ubicacion')}</td>
                </tr>
            </tbody>
        </table>
    </div>
`;

const getRecipientEmails = (recipients = []) => (
    recipients
        .map((recipient) => recipient.recipient_value)
        .filter(Boolean)
);

const getUniqueRecipientEmails = (recipients = []) => [...new Set(getRecipientEmails(recipients))];

const resolveDepartureSource = () => EBT_COLOMBIA_GEOFENCE_SOURCE;

const resolveSourceRecordId = (item) => (
    item?._geofence_event_id || item?._gps?.id || item?.source_record_id || item?.yard_record_id || null
);

const buildGeofenceEventWindow = () => {

    const now = Date.now();

    return {
        start: toUtcSqlDateTime(new Date(now - GEOFENCE_EVENT_WINDOW_PAST_MS)),
        end: toUtcSqlDateTime(new Date(now + GEOFENCE_EVENT_WINDOW_FUTURE_MS)),
    };

};

const buildCustomsNotificationWindow = () => {

    const now = Date.now();

    return {
        start: toUtcSqlDateTime(new Date(now - CUSTOMS_NOTIFICATION_WINDOW_PAST_MS)),
        end: toUtcSqlDateTime(new Date(now + CUSTOMS_NOTIFICATION_WINDOW_FUTURE_MS)),
    };

};

const getSortedGeofenceEvents = async ({ trailerId, start, end }) => {

    const events = await getEbtColombiaGeofenceEvents({
        vehicle: trailerId,
        start,
        end,
    });

    return events
        .map((event) => ({
            ...event,
            _event_date: toUtcStoredDateOrNull(event.date_event),
            _event_date_sql: toLocalSqlDateTime(toUtcStoredDateOrNull(event.date_event)),
        }))
        .filter((event) => event._event_date && event._event_date_sql)
        .sort((a, b) => (
            a._event_date.getTime() - b._event_date.getTime()
            || Number(a.id || 0) - Number(b.id || 0)
        ));

};

const buildNotificationItemFromCustomsEntryEvent = ({ item, event }) => ({
    ...item,
    exit_at: event._event_date_sql,
    source_record_id: event.id || null,
    _geofence_event_id: event.id || null,
    _trigger_source: 'MEXICAN_CUSTOMS_START_GEOFENCE_ENTRY',
    _skip_departure_update: true,
});

const processGeofenceEntryEvent = async ({ item, event, state }) => {

    const eventTime = event._event_date.getTime();
    const departureTime = state.actualDeparture?.getTime() || null;

    if (!state.actualArrival) {
        const arrivalStopUpdate = await updateColombiaYardStopArrival({
            cross_stop_id: item.pension_stop_id,
            cross_id: item.cross_id,
            actual_arrival: event._event_date_sql,
            actual_arrival_source: EBT_COLOMBIA_GEOFENCE_SOURCE,
            actual_arrival_source_record_id: event.id || null,
        });

        if (arrivalStopUpdate.updated) {
            state.actualArrival = event._event_date;
            state.actualArrivalSourceRecordId = event.id || null;
        }

        return {
            action: 'ARRIVAL',
            event_id: event.id || null,
            date_event: event._event_date_sql,
            arrivalStopUpdate,
        };
    }

    if (state.actualDeparture && eventTime > departureTime) {
        const clearDepartureUpdate = await clearColombiaYardStopDeparture({
            cross_stop_id: item.pension_stop_id,
            cross_id: item.cross_id,
        });

        if (clearDepartureUpdate.updated) {
            state.actualDeparture = null;
            state.actualDepartureSourceRecordId = null;
        }

        return {
            action: 'CLEAR_DEPARTURE_AFTER_REENTRY',
            event_id: event.id || null,
            date_event: event._event_date_sql,
            clearDepartureUpdate,
        };
    }

    return {
        action: 'SKIPPED_ENTRY',
        event_id: event.id || null,
        date_event: event._event_date_sql,
        reason: 'arrival_already_set',
    };

};

const processGeofenceExitEvent = async ({ item, event, state }) => {

    const eventTime = event._event_date.getTime();
    const arrivalTime = state.actualArrival?.getTime() || null;
    const departureTime = state.actualDeparture?.getTime() || null;

    if (!state.actualArrival) {
        return {
            action: 'SKIPPED_EXIT',
            event_id: event.id || null,
            date_event: event._event_date_sql,
            reason: 'missing_arrival',
        };
    }

    if (eventTime <= arrivalTime) {
        return {
            action: 'SKIPPED_EXIT',
            event_id: event.id || null,
            date_event: event._event_date_sql,
            reason: 'exit_before_arrival',
        };
    }

    if (state.actualDeparture && eventTime <= departureTime) {
        return {
            action: 'SKIPPED_EXIT',
            event_id: event.id || null,
            date_event: event._event_date_sql,
            reason: 'older_than_current_departure',
        };
    }

    const departureStopUpdate = await updateColombiaYardStopDeparture({
        cross_stop_id: item.pension_stop_id,
        cross_id: item.cross_id,
        actual_departure: event._event_date_sql,
        actual_departure_source: EBT_COLOMBIA_GEOFENCE_SOURCE,
        actual_departure_source_record_id: event.id || null,
    });

    if (departureStopUpdate.updated) {
        state.actualDeparture = event._event_date;
        state.actualDepartureSourceRecordId = event.id || null;
    }

    return {
        action: 'DEPARTURE',
        event_id: event.id || null,
        date_event: event._event_date_sql,
        departureStopUpdate,
    };

};

const processGeofenceEventsForItem = async ({ item, start, end }) => {

    const events = await getSortedGeofenceEvents({
        trailerId: item.trailer_id,
        start,
        end,
    });
    const state = {
        actualArrival: isMcleodSource(item.pension_actual_arrival_source)
            ? null
            : toDateOrNull(item.pension_actual_arrival),
        actualArrivalSourceRecordId: isMcleodSource(item.pension_actual_arrival_source)
            ? null
            : item.pension_actual_arrival_source_record_id || null,
        actualDeparture: isMcleodSource(item.pension_actual_departure_source)
            ? null
            : toDateOrNull(item.pension_actual_departure),
        actualDepartureSourceRecordId: isMcleodSource(item.pension_actual_departure_source)
            ? null
            : item.pension_actual_departure_source_record_id || null,
    };
    const eventResults = [];

    for (const event of events) {
        const normalizedEvent = String(event.event || '').trim().toUpperCase();
        const result = normalizedEvent === 'GEOFENCE ENTRY'
            ? await processGeofenceEntryEvent({ item, event, state })
            : normalizedEvent === 'GEOFENCE EXIT'
                ? await processGeofenceExitEvent({ item, event, state })
                : {
                    action: 'SKIPPED_EVENT',
                    event_id: event.id || null,
                    date_event: event._event_date_sql,
                    reason: 'unsupported_event',
                };

        eventResults.push(result);
    }

    return {
        cross_id: item.cross_id,
        trailer_id: item.trailer_id,
        eventsCount: events.length,
        updatedCount: eventResults.filter((result) => (
            result.arrivalStopUpdate?.updated
            || result.departureStopUpdate?.updated
            || result.clearDepartureUpdate?.updated
        )).length,
        eventResults,
    };

};

const updatePendingArrivalItems = async () => {

    const candidates = await getColombiaYardGeofenceEventCandidates();
    const window = buildGeofenceEventWindow();
    const results = [];

    for (const item of candidates) {
        try {
            const result = await processGeofenceEventsForItem({
                item,
                ...window,
            });

            results.push({
                status: 'PROCESSED',
                ...result,
            });
        } catch (error) {
            results.push({
                cross_id: item.cross_id,
                trailer_id: item.trailer_id,
                status: 'ERROR',
                error: error.message,
            });
        }
    }

    return {
        window,
        candidatesCount: candidates.length,
        pendingCount: 0,
        updatedCount: results.reduce((total, result) => total + Number(result.updatedCount || 0), 0),
        errorCount: results.filter((result) => result.status === 'ERROR').length,
        results,
    };

};

const getSortedCustomsStartEntryEvents = async ({ trailerId, start, end }) => {

    const eventSets = await Promise.all(
        MEXICAN_CUSTOMS_NOTIFICATION_GEOFENCES.map((geofence) => (
            getTkGeofenceEvents({
                vehicle: trailerId,
                geofence,
                start,
                end,
            })
        ))
    );

    return eventSets
        .flat()
        .filter((event) => String(event.event || '').trim().toUpperCase() === 'GEOFENCE ENTRY')
        .map((event) => ({
            ...event,
            _event_date: toUtcStoredDateOrNull(event.date_event),
            _event_date_sql: toLocalSqlDateTime(toUtcStoredDateOrNull(event.date_event)),
        }))
        .filter((event) => event._event_date && event._event_date_sql)
        .sort((a, b) => (
            a._event_date.getTime() - b._event_date.getTime()
            || Number(a.id || 0) - Number(b.id || 0)
        ));

};

const getPendingCustomsStartNotificationItems = async () => {

    const candidates = (await getColombiaYardGeofenceEventCandidates())
        .filter((item) => Number(item.notification_sent_count || 0) === 0);
    const window = buildCustomsNotificationWindow();
    const results = [];
    const notificationItems = [];

    for (const item of candidates) {
        try {
            const events = await getSortedCustomsStartEntryEvents({
                trailerId: item.trailer_id,
                ...window,
            });
            const event = events[0] || null;

            results.push({
                cross_id: item.cross_id,
                trailer_id: item.trailer_id,
                status: 'PROCESSED',
                eventsCount: events.length,
                notificationEventId: event?.id || null,
            });

            if (event) {
                notificationItems.push(buildNotificationItemFromCustomsEntryEvent({
                    item,
                    event,
                }));
            }
        } catch (error) {
            results.push({
                cross_id: item.cross_id,
                trailer_id: item.trailer_id,
                status: 'ERROR',
                error: error.message,
            });
        }
    }

    return {
        window,
        geofences: MEXICAN_CUSTOMS_NOTIFICATION_GEOFENCES,
        candidatesCount: candidates.length,
        pendingCount: notificationItems.length,
        errorCount: results.filter((result) => result.status === 'ERROR').length,
        notificationItems,
        results,
    };

};

const getItemRecipients = async (item) => {

    if (!item.customer_group_id) {
        return [];
    }

    return getNotificationReasonRecipients({
        customer_group_id: item.customer_group_id,
        notification_reason_code: NOTIFICATION_REASON_CODE,
        notification_channel_code: NOTIFICATION_CHANNEL_CODE,
        is_active: 1,
    });

};

const processNotificationItem = async ({ item }) => {

    const gps = item._gps || (item.trailer_id ? await getTrailerData(item.trailer_id) : null);
    const etaResult = await calculateEtaToDestinationStop({
        item,
        gps,
    });
    const recipients = await getItemRecipients(item);
    const destinatarios = getUniqueRecipientEmails(recipients);

    if (!destinatarios.length) {
        return {
            cross_id: item.cross_id,
            trailer_id: item.trailer_id,
            mcleod_order_id: item.mcleod_order_id,
            customer_group_id: item.customer_group_id || null,
            status: 'SKIPPED',
            reason: item.customer_group_id ? 'missing_recipients' : 'missing_customer_group',
        };
    }

    const subject = buildEmailSubject(item);
    const html = buildEmailHtml({
        item,
        gps,
        etaResult,
    });
    const logPayload = {
        notification_reason_id: recipients[0]?.notification_reason_id || null,
        notification_channel_id: recipients[0]?.notification_channel_id || null,
        customer_group_id: item.customer_group_id || null,
        entity_id: item.cross_id,
        subject,
        recipients_json: JSON.stringify(destinatarios),
        sent_at: new Date(),
    };
    let emailResponse = null;

    try {
        emailResponse = await sendEmail({
            destinatarios,
            asunto: subject,
            html,
        });
    } catch (error) {
        const failed = await insertNotificationDispatchLog({
            ...logPayload,
            status: 'FAILED',
        });

        return {
            cross_id: item.cross_id,
            trailer_id: item.trailer_id,
            mcleod_order_id: item.mcleod_order_id,
            customer_group_id: item.customer_group_id,
            status: 'ERROR',
            error: error.message,
            destinatarios,
            sent: failed,
        };
    }

    const sent = await insertNotificationDispatchLog({
        ...logPayload,
        status: 'SENT',
    });
    const departureStopUpdate = item._skip_departure_update
        ? {
            updated: false,
            skippedReason: 'notification_trigger_only',
        }
        : item._departure_stop_update || await updateColombiaOriginStopDeparture({
            cross_stop_id: item.departure_stop_id || item.origin_stop_id,
            cross_id: item.cross_id,
            actual_departure: item.exit_at,
            actual_departure_source: resolveDepartureSource(item),
            actual_departure_source_record_id: resolveSourceRecordId(item),
        });
    const persistedEta = departureStopUpdate.updated
        ? await recalculateAndPersistNextStopEta({
            crossId: item.cross_id,
            trailerId: item.trailer_id,
        })
        : {
            updated: false,
            skippedReason: 'departure_not_updated',
        };

    return {
        cross_id: item.cross_id,
        trailer_id: item.trailer_id,
        mcleod_order_id: item.mcleod_order_id,
        customer_group_id: item.customer_group_id,
        origin_stop_id: item.origin_stop_id,
        departure_stop_id: item.departure_stop_id || item.origin_stop_id,
        destination_stop_id: item.destination_stop_id,
        triggerSource: item._trigger_source || 'EBT_COLOMBIA_GEOFENCE_EVENT',
        triggerGeofences: item._trigger_geofences || [],
        eta: etaResult.eta,
        etaSkippedReason: etaResult.skippedReason,
        persistedEta,
        destinatarios,
        emailResponse,
        sent,
        departureStopUpdate,
    };

};

export const runColombiaYardExitNotifications = async () => {

    const arrivalUpdates = await updatePendingArrivalItems();
    const customsStartNotifications = await getPendingCustomsStartNotificationItems();
    const pendingItems = customsStartNotifications.notificationItems;
    const results = [];

    for (const item of pendingItems) {
        try {
            const result = await processNotificationItem({ item });

            results.push({
                status: result.status || 'SENT',
                ...result,
            });
        } catch (error) {
            results.push({
                cross_id: item.cross_id,
                trailer_id: item.trailer_id,
                status: 'ERROR',
                error: error.message,
            });
        }
    }

    return {
        arrivalUpdates,
        customsStartNotifications,
        pendingCount: pendingItems.length,
        primaryPendingCount: 0,
        fallbackCandidatesCount: 0,
        fallbackPendingCount: 0,
        sentCount: results.filter((result) => result.status === 'SENT').length,
        skippedCount: results.filter((result) => result.status === 'SKIPPED').length,
        errorCount: results.filter((result) => result.status === 'ERROR').length,
        fallbackSkippedItems: [],
        results,
    };

};
