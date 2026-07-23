import axios from 'axios';

const EMAIL_ENDPOINT = 'https://apifuncionesgenerales.ebtapps.com/api/sendEmails/1';
const EMAIL_ACCESS_TOKEN = 'R9345FG35D68BE6R56ER51BSD36R51E6TJ8J';
const EMAIL_SUBJECT = 'Tracking - EBT';

const normalizeChannelCode = (value) => String(value || '').trim().toUpperCase();

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

const resolveGpsLocation = (gps) => firstValue(
    gps?.ubicacion,
    gps?.location,
    gps?.address,
    gps?.direccion,
    gps?.position,
    gps?.posicion,
    gps?.nearest_city,
    gps?.ciudad,
);

const resolveLatitude = (gps) => firstValue(
    gps?.latitude,
    gps?.lat,
    gps?.Latitud,
    gps?.latitud,
);

const resolveLongitude = (gps) => firstValue(
    gps?.longitude,
    gps?.lng,
    gps?.lon,
    gps?.Longitud,
    gps?.longitud,
);

const buildGoogleMapsUrl = (gps) => {

    const latitude = resolveLatitude(gps);
    const longitude = resolveLongitude(gps);

    if (latitude && longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${longitude},${latitude}`)}`;
    }

    const location = resolveGpsLocation(gps);

    return location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
        : null;

};

const getRecipientValues = (recipients = []) => (
    recipients
        .map((recipient) => recipient?.recipient_value)
        .filter(Boolean)
);

const buildEmailRows = (crossings = []) => crossings.map((crossing) => {

    const unit = firstValue(
        crossing?.cross?.trailer_id,
        crossing?.gps?.trailer,
        crossing?.gps?.unidad,
        crossing?.gps?.unit,
        'Sin unidad'
    );
    const location = resolveGpsLocation(crossing?.gps) || 'Sin posicion disponible';
    const mapsUrl = buildGoogleMapsUrl(crossing?.gps);
    const mapsButton = mapsUrl
        ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" style="background-color: #3688F4; color: #ffffff; display: inline-block; padding: 8px 12px; text-decoration: none; border-radius: 4px;">Ver mapa</a>`
        : 'Sin mapa';

    return `
        <tr>
            <td style="border: 1px solid #d9e2ec; padding: 8px; text-align: center;">${escapeHtml(unit)}</td>
            <td style="border: 1px solid #d9e2ec; padding: 8px;">${escapeHtml(location)}</td>
            <td style="border: 1px solid #d9e2ec; padding: 8px; text-align: center;">${mapsButton}</td>
        </tr>
    `;

}).join('');

const buildEmailHtml = (notification) => `
    <div style="font-family: Arial, sans-serif; padding: 16px; color: #1f2933;">
        <h2 style="color: #333333; margin: 0 0 12px;">Tracking - EBT</h2>
        <table cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <thead>
                <tr>
                    <th style="background-color: #3688F4; color: white; padding: 8px; text-align: center; border: 1px solid #3688F4;">Unidad</th>
                    <th style="background-color: #3688F4; color: white; padding: 8px; text-align: center; border: 1px solid #3688F4;">Ultima posicion</th>
                    <th style="background-color: #3688F4; color: white; padding: 8px; text-align: center; border: 1px solid #3688F4;">Mapa</th>
                </tr>
            </thead>
            <tbody>
                ${buildEmailRows(notification?.crossings || []) || '<tr><td colspan="3" style="border: 1px solid #d9e2ec; padding: 8px; text-align: center;">Sin cargas activas</td></tr>'}
            </tbody>
        </table>
    </div>
`;

const emailNotificationHandler = async (notification) => {

    const destinatarios = getRecipientValues(notification.recipients);
    const html = buildEmailHtml(notification);

    if (!destinatarios.length) {
        return {
            channel: 'EMAIL',
            status: 'SKIPPED',
            reason: 'Sin destinatarios',
            notification,
        };
    }

    const response = await axios.post(
        EMAIL_ENDPOINT,
        {
            destinatarios,
            asunto: EMAIL_SUBJECT,
            html,
        },
        {
            headers: {
                'access-token': EMAIL_ACCESS_TOKEN,
            },
        }
    );

    return {
        channel: 'EMAIL',
        status: 'SENT',
        destinatarios,
        response: response.data,
    };

};

const CHANNEL_HANDLERS = {
    EMAIL: emailNotificationHandler,
};

export const dispatchNotificationByChannel = async (notification) => {

    const channelCode = normalizeChannelCode(notification?.channel?.code);
    const handler = CHANNEL_HANDLERS[channelCode];

    if (!handler) {
        return {
            channel: channelCode || null,
            status: 'SKIPPED',
            reason: 'Canal de notificacion no soportado',
            notification,
        };
    }

    return handler(notification);

};
