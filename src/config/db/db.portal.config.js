import mysql from 'mysql2/promise';
import envData from '../env/env.config.js';

// =================================
// CONFIGURACION DE POOL DE CONEXIONES
// =================================

const pool = mysql.createPool({
    host:               envData.db.host,
    user:               envData.db.user,
    password:           envData.db.password,
    database:           envData.db.database,
    waitForConnections: true,
    connectionLimit:    10,
    connectTimeout:     20000,
    enableKeepAlive:    true,
    keepAliveInitialDelay: 0
});

const TRANSIENT_CONNECTION_ERRORS = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'PROTOCOL_CONNECTION_LOST',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
]);

const isTransientConnectionError = (error) => {
    return TRANSIENT_CONNECTION_ERRORS.has(error?.code);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// =================================
// FUNCIONES PARA EJECUTAR STORED PROCEDURES
// =================================

export const executeSp = async ( spName, params = [] ) => {

    if ( !spName ) throw new Error('No SP name provided');

    // GENERA ? SEGUN PARAMETROS
    const placeholders = params.length ? params.map(() => '?').join(', ') : '';

    const sql = `CALL ${spName}(${placeholders})`;

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const [ results ] = await pool.execute(sql, params);
            return results;
        } catch (error) {
            if (!isTransientConnectionError(error) || attempt === maxAttempts) {
                throw error;
            }

            await wait(250 * attempt);
        }
    }

}

export const closeDbPool = async () => {
    await pool.end();
};

export default pool;
