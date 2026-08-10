import axios from 'axios';
import envData from '../../config/env/env.config.js';

const API_URL = envData.pcMiller.url;
const API_TOKEN = envData.pcMiller.token;

const DEFAULT_TIMEOUT = 30000;

const validatePcMillerConfig = (baseUrl) => {

    if (!API_URL) {
        throw new Error('PC_MILLER_API_URL no esta configurada');
    }

    if (!API_TOKEN) {
        throw new Error('PC_MILLER_API_TOKEN no esta configurado');
    }

    if (!baseUrl || typeof baseUrl !== 'string') {
        throw new Error('baseUrl es requerida y debe ser string');
    }

};

const buildPcMillerUrl = (baseUrl) => `${API_URL}${baseUrl}`;

/*=============================================
FUNCION PARA OBTENER DATOS DE PC MILLER
=============================================*/

export const fetchPcMillerData = async (

    baseUrl,
    params = {},
    options = {}

) => {

    validatePcMillerConfig(baseUrl);

    const {
        timeout = DEFAULT_TIMEOUT,
    } = options;

    try {

        const response = await axios.get(buildPcMillerUrl(baseUrl), {
            params: {
                ...params,
                authtoken: API_TOKEN,
            },
            timeout,
        });

        return response.data;

    } catch (error) {

        console.error('Error consultando PC Miller', {
            baseUrl,
            status: error?.response?.status,
            message: error.message,
        });

        throw error;

    }

};
