import { createHash } from 'node:crypto';
import { executeSp } from '../../config/db/db.portal.config.js';

const getFirstResultSet = (resultSets = []) => {

    if (!Array.isArray(resultSets)) {
        return [];
    }

    return resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

};

const getFirstRow = (resultSets = []) => (
    getFirstResultSet(resultSets)[0] || null
);

const toMd5 = (value) => (
    value ? createHash('md5').update(String(value)).digest('hex') : null
);

export const getPortalUsers = async ({
    nombre = null,
    email = null,
    customerName = null,
    portalGroudId = null,
} = {}) => {

    const resultSets = await executeSp('sysebtapps_prd_coresys.sp_portal_users_get', [
        nombre,
        email,
        customerName,
        portalGroudId,
    ]);

    return getFirstResultSet(resultSets);

};

export const insertPortalUser = async ({
    nombres = null,
    apellidos = null,
    email = null,
    password = null,
    idPerfil = null,
    yardId = 0,
    customerCode = 'EBT',
    customerName = 'EBT',
    estado = 1,
    portalGroudId = null,
} = {}) => {

    const resultSets = await executeSp('sysebtapps_prd_coresys.sp_portal_users_insert', [
        nombres,
        apellidos,
        email,
        toMd5(password),
        idPerfil,
        yardId,
        customerCode,
        customerName,
        estado,
        portalGroudId,
    ]);

    return getFirstRow(resultSets) || {
        success: true,
    };

};

export const updatePortalUser = async ({
    idUsuario,
    nombres = null,
    apellidos = null,
    email = null,
    password = null,
    idPerfil = null,
    yardId = 0,
    customerCode = 'EBT',
    customerName = 'EBT',
    estado = 1,
    portalGroudId = null,
} = {}) => {

    const resultSets = await executeSp('sysebtapps_prd_coresys.sp_portal_users_update', [
        idUsuario,
        nombres,
        apellidos,
        email,
        toMd5(password),
        idPerfil,
        yardId,
        customerCode,
        customerName,
        estado,
        portalGroudId,
    ]);

    return getFirstRow(resultSets) || {
        id_usuario: idUsuario,
        success: true,
    };

};
