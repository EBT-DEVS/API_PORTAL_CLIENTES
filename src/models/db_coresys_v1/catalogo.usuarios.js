import { executeSp } from '../../config/db/db.portal.config.js';

export const getPortalClientUserByEmail = async (email) => {

    const resultSets = await executeSp('sysebtapps_prd_coresys.sp_login_portal_clientes', [
        email,
    ]);

    return resultSets[0]?.[0] || null;

};

export const getUsuarioCustomer = async (idUsuario) => {

    const resultSets = await executeSp('sysebtapps_prd_coresys.sp_usuario_customer_get', [
        idUsuario,
    ]);

    return resultSets[0]?.[0] || null;

};
