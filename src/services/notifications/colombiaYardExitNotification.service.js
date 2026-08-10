import { getTrailerData } from '../../models/db_gps/trailers.model.js';
import { getCustomsGeofencesContainingPoint } from '../../models/db_gps/geofences.model.js';
import {
    getColombiaYardExitNotificationFallbackCandidates,
    getColombiaYardExitNotificationRecipients,
    getPendingColombiaYardExitNotifications,
    markColombiaYardExitNotificationSent,
    updateColombiaOriginStopDeparture,
} from '../../models/notifications/colombia.yard.exit.notifications.model.js';
import { enrichActiveStopEtaFromPcMiller } from '../crosses/crossesPcMillerEta.service.js';
import { sendEmail } from './notificationChannelDispatcher.service.js';

const buildEmailSubject = (item) => `Caja ${item?.trailer_id || 'sin caja'} camino a cruce`;
const COLOMBIA_YARD_TIME_ZONE = 'America/Matamoros';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
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

const buildEmailHtml = ({ item, gps, etaResult }) => `
    <div style="font-family: Arial, sans-serif; padding: 16px; color: #1f2933;">
        <h2 style="margin: 0 0 12px; color: #1f2933;">Caja salio de Patio EBT (Colombia) para iniciar cruce</h2>
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
                    <td style="border: 1px solid #d9e2ec; padding: 8px; font-weight: bold;">Salida</td>
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
        .map((recipient) => recipient.email)
        .filter(Boolean)
);

const resolveDepartureSource = (item) => (
    item?._trigger_source === 'GPS_MEXICAN_CUSTOMS_GEOFENCE'
        ? 'GPS_GEOFENCE'
        : 'YARD_EXIT'
);

const getFallbackItemIfInsideMexicanCustoms = async (item) => {

    const gps = item.trailer_id ? await getTrailerData(item.trailer_id) : null;

    if (!hasGpsCoordinates(gps)) {
        return null;
    }

    const geofences = await getCustomsGeofencesContainingPoint(resolveGpsCoordinates(gps));
    const mexicanCustomsGeofences = geofences.filter(isMexicanCustomsGeofence);

    if (!mexicanCustomsGeofences.length) {
        return null;
    }

    return {
        ...item,
        exit_at: resolveGpsDateTime(gps) || item.exit_at || toTimeZoneSqlDateTime(),
        _gps: gps,
        _trigger_source: 'GPS_MEXICAN_CUSTOMS_GEOFENCE',
        _trigger_geofences: mexicanCustomsGeofences,
    };

};

const getFallbackPendingItems = async ({ excludeCrossIds = new Set() } = {}) => {

    const candidates = await getColombiaYardExitNotificationFallbackCandidates();
    const pendingItems = [];
    const skippedItems = [];

    for (const candidate of candidates) {
        if (excludeCrossIds.has(candidate.cross_id)) {
            continue;
        }

        try {
            const fallbackItem = await getFallbackItemIfInsideMexicanCustoms(candidate);

            if (!fallbackItem) {
                skippedItems.push({
                    cross_id: candidate.cross_id,
                    trailer_id: candidate.trailer_id,
                    reason: 'not_inside_mexican_customs_geofence',
                });
                continue;
            }

            pendingItems.push(fallbackItem);
        } catch (error) {
            skippedItems.push({
                cross_id: candidate.cross_id,
                trailer_id: candidate.trailer_id,
                reason: error.message,
            });
        }
    }

    return {
        candidatesCount: candidates.length,
        pendingItems,
        skippedItems,
    };

};

const processNotificationItem = async ({ item, recipients }) => {

    const gps = item._gps || (item.trailer_id ? await getTrailerData(item.trailer_id) : null);
    const etaResult = await calculateEtaToDestinationStop({
        item,
        gps,
    });
    const destinatarios = getRecipientEmails(recipients);
    const html = buildEmailHtml({
        item,
        gps,
        etaResult,
    });
    const emailResponse = await sendEmail({
        destinatarios,
        asunto: buildEmailSubject(item),
        html,
    });
    const sent = await markColombiaYardExitNotificationSent({
        cross_id: item.cross_id,
        trailer_id: item.trailer_id,
        mcleod_order_id: item.mcleod_order_id,
        yard_name: item.yard_name,
        exit_at: item.exit_at,
        recipients_json: JSON.stringify(destinatarios),
    });
    const departureStopUpdate = await updateColombiaOriginStopDeparture({
        cross_stop_id: item.departure_stop_id || item.origin_stop_id,
        cross_id: item.cross_id,
        actual_departure: item.exit_at,
        actual_departure_source: resolveDepartureSource(item),
    });

    return {
        cross_id: item.cross_id,
        trailer_id: item.trailer_id,
        mcleod_order_id: item.mcleod_order_id,
        origin_stop_id: item.origin_stop_id,
        departure_stop_id: item.departure_stop_id || item.origin_stop_id,
        destination_stop_id: item.destination_stop_id,
        triggerSource: item._trigger_source || 'D31_YARD_EXIT',
        triggerGeofences: item._trigger_geofences || [],
        eta: etaResult.eta,
        etaSkippedReason: etaResult.skippedReason,
        destinatarios,
        emailResponse,
        sent,
        departureStopUpdate,
    };

};

export const runColombiaYardExitNotifications = async () => {

    const recipients = await getColombiaYardExitNotificationRecipients({
        isActive: 1,
    });
    const primaryPendingItems = await getPendingColombiaYardExitNotifications();
    const fallbackResult = await getFallbackPendingItems({
        excludeCrossIds: new Set(primaryPendingItems.map((item) => item.cross_id)),
    });
    const pendingItems = [
        ...primaryPendingItems.map((item) => ({
            ...item,
            _trigger_source: 'D31_YARD_EXIT',
        })),
        ...fallbackResult.pendingItems,
    ];
    const results = [];

    if (!recipients.length) {
        return {
            pendingCount: pendingItems.length,
            sentCount: 0,
            skippedCount: pendingItems.length,
            results: pendingItems.map((item) => ({
                cross_id: item.cross_id,
                trailer_id: item.trailer_id,
                status: 'SKIPPED',
                reason: 'missing_recipients',
            })),
        };
    }

    for (const item of pendingItems) {
        try {
            results.push({
                status: 'SENT',
                ...(await processNotificationItem({
                    item,
                    recipients,
                })),
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
        pendingCount: pendingItems.length,
        primaryPendingCount: primaryPendingItems.length,
        fallbackCandidatesCount: fallbackResult.candidatesCount,
        fallbackPendingCount: fallbackResult.pendingItems.length,
        sentCount: results.filter((result) => result.status === 'SENT').length,
        skippedCount: results.filter((result) => result.status === 'SKIPPED').length,
        errorCount: results.filter((result) => result.status === 'ERROR').length,
        fallbackSkippedItems: fallbackResult.skippedItems,
        results,
    };

};
