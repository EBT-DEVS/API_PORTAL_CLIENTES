
import envData from '../env/env.config.js';
import jwt from 'jsonwebtoken';

const API_SECRET = envData.tokens.secret;
const API_EXPIRATION = envData.tokens.expiration;
const LOGIN_SECRET = envData.login.api_secret;
const API_TOKEN_OPTIONS = Number.isFinite(API_EXPIRATION) && API_EXPIRATION > 0
    ? { expiresIn: API_EXPIRATION }
    : undefined;

/*========================================
FIRMAR TOKEN API CUSTOMER
========================================*/

export const signToken = ( userData ) => {

    try {

        if (!API_SECRET) {
            throw new Error('API_TOKEN_CUSTOMER_SECRET no esta configurado');
        }

        const payload = {

            idUser: userData.idUser,
            nombre: userData.nombre,
            email: userData.email,
            idPerfil: userData.idPerfil,
            customer_code: userData.customer_code,
            customer_name: userData.customer_name,

        }

        const token = jwt.sign(payload, API_SECRET, API_TOKEN_OPTIONS);

        return token;

    } catch (error) {

        console.error('Error signing customer token:', error.message);

        return null;

    }

}

export const signPortalClientToken = (userData) => {

    try {

        if (!API_SECRET) {
            throw new Error('API_TOKEN_CUSTOMER_SECRET no esta configurado');
        }

        const payload = {
            id_usuario: userData.id_usuario,
            nombres: userData.nombres,
            apellidos: userData.apellidos,
            email: userData.email,
            customer_code: userData.customer_code,
            customer_name: userData.customer_name,
        };

        return jwt.sign(payload, API_SECRET, API_TOKEN_OPTIONS);

    } catch (error) {

        console.error('Error signing portal client token:', error.message);

        return null;

    }

};

/*========================================
VALIDAR TOKEN DE LOGIN
========================================*/

export const validateLoginToken = ( apiToken ) => {

    try {

        const data = jwt.verify(apiToken, LOGIN_SECRET);

        return data;

    } catch (error) {

        return null;

    }

}
