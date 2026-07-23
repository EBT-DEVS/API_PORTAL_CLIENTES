import axios from 'axios';
import envData from '../../config/env/env.config.js';

const API_URL   = envData.mcleod.url;
const API_TOKEN = envData.mcleod.token;
const API_USER  = envData.mcleod.user;
const API_PASS  = envData.mcleod.password;

const MCLEOD_COMPANIES = {
    ebt   : 'TMS',
    ebf   : 'TMS2',
    tedel : 'TMS3',
};

const TOKEN_AUTH_COMPANIES = new Set(['ebt']);

const buildBasicAuthorization = () => (
    `Basic ${Buffer.from(`${API_USER}:${API_PASS}`).toString('base64')}`
);

const getAuthorization = (company = 'ebt') => {

    if (TOKEN_AUTH_COMPANIES.has(company)) {
        return API_TOKEN;
    }

    return buildBasicAuthorization();

};

const createMcleodHeaders = ( company = 'ebt' ) => {

    const anywhereCompanyId = MCLEOD_COMPANIES[company];

    if (!anywhereCompanyId) {
        throw new Error(`Company invalida: ${company}`);
    }

    return {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: getAuthorization(company),
        AnywhereCompanyID: anywhereCompanyId,
    };

};

const validateMcleodConfig = (baseUrl, company = 'ebt') => {

    if (!API_URL) {
        throw new Error('MCLEOD_API_URL no esta configurada');
    }

    if (!MCLEOD_COMPANIES[company]) {
        throw new Error(`Company invalida: ${company}`);
    }

    if (TOKEN_AUTH_COMPANIES.has(company) && !API_TOKEN) {
        throw new Error('MCLEOD_API_TOKEN no esta configurado para ebt/TMS');
    }

    if (!TOKEN_AUTH_COMPANIES.has(company) && (!API_USER || !API_PASS)) {
        throw new Error(`MCLEOD_API_USER y MCLEOD_API_PASS son requeridos para ${company}`);
    }

    if (!baseUrl || typeof baseUrl !== 'string') {
        throw new Error('baseUrl es requerida y debe ser string');
    }

};

const isEmptyResponse = (data) => (
    !data ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' && Object.keys(data).length === 0)
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/*=============================================
FUNCION PARA OBTENER DATOS (ARRAYS) DE MCLEOD
=============================================*/

export const fetchMcleodData = async (

    baseUrl,
    company = 'ebt',
    options = {}

) => {

    validateMcleodConfig(baseUrl, company);

    const {
        maxPages = 100,
        timeout = 30000,
        retries = 2,
        retryDelayMs = 1000,
    } = options;

    const allData = [];
    const seenOffsets = new Set();
    let offset = 0;
    let currentPage = 0;
    let pageSize = null;

    while (currentPage < maxPages) {

        if (seenOffsets.has(offset)) {
            throw new Error(`Loop de paginacion detectado en offset=${offset}`);
        }

        seenOffsets.add(offset);

        const separator = baseUrl.includes('?') ? '&' : '?';
        const url = `${API_URL}${baseUrl}${separator}recordOffset=${offset}`;

        let response;
        let attempt = 0;

        while (attempt <= retries) {

            try {

                response = await axios.get(url, {
                    headers: createMcleodHeaders(company),
                    timeout,
                });

                break;

            } catch (error) {

                const status = error?.response?.status;
                const isRetryable = [429, 502, 503, 504].includes(status) || !status;

                if (attempt === retries || !isRetryable) {

                    console.error('Error consultando McLeod', {
                        company,
                        baseUrl,
                        offset,
                        status,
                        message: error.message,
                    });

                    throw error;

                }

                await wait(retryDelayMs * (attempt + 1));
                attempt++;

            }

        }

        const data = response?.data;

        if (data == null) {
            break;
        }

        if (!Array.isArray(data)) {
            throw new Error(
                `Respuesta invalida de McLeod en offset=${offset}: se esperaba un array`
            );
        }

        if (data.length === 0) {
            break;
        }

        allData.push(...data);

        if (pageSize === null) {
            pageSize = data.length;
        }

        if (data.length < pageSize) {
            break;
        }

        offset += data.length;
        currentPage++;

    }

    if (currentPage === maxPages) {
        throw new Error(`Se alcanzo maxPages=${maxPages} al consultar McLeod`);
    }

    return allData;

};

/*=============================================
FUNCION PARA OBTENER ITEM DE MCLEOD
=============================================*/

export const fetchMcleodItem = async (baseUrl, company = 'ebt') => {

    validateMcleodConfig(baseUrl, company);

    try {

        const url = `${API_URL}${baseUrl}`;
        const response = await axios.get(url, {
            headers: createMcleodHeaders(company),
        });

        const data = response.data;

        if (isEmptyResponse(data)) {
            return false;
        }

        return data;

    } catch (error) {

        console.error('Error consultando item de McLeod', {
            company,
            baseUrl,
            status: error?.response?.status,
            message: error.message,
        });

        throw error;

    }

};
