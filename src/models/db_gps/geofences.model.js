import pool from '../../config/db/db.portal.config.js';

const CUSTOMS_GEOFENCE_SQL = `
    SELECT
        id,
        code,
        name,
        CASE
            WHEN UPPER(name) LIKE '%AMERICANA%' THEN 'US_CUSTOMS'
            WHEN UPPER(name) LIKE '%MEX%' THEN 'MX_CUSTOMS'
            ELSE NULL
        END AS stop_code
    FROM sysebtapps_prd_gps_data.ebt_geofences
    WHERE is_active = 1
      AND UPPER(name) LIKE '%ADUANA%'
      AND (
          UPPER(name) LIKE '%AMERICANA%'
          OR UPPER(name) LIKE '%MEX%'
      )
      AND ST_Contains(polygon, ST_GeomFromText(?, 4326))
    ORDER BY
        CASE
            WHEN UPPER(name) LIKE '%COLOMBIA%' THEN 0
            ELSE 1
        END,
        id
`;

export const getCustomsGeofencesContainingPoint = async ({
    latitude,
    longitude,
} = {}) => {

    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
        return [];
    }

    const point = `POINT(${Number(latitude)} ${Number(longitude)})`;
    const [rows] = await pool.execute(CUSTOMS_GEOFENCE_SQL, [
        point,
    ]);

    return rows.filter((row) => row.stop_code);

};
