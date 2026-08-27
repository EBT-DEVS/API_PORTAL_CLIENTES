import axios from 'axios';
import crypto from 'crypto';
import envData from '../../config/env/env.config.js';
import { signPortalClientToken, signToken, validateLoginToken } from '../../config/tokens/token.config.js';
import { getPortalClientUserByEmail, getUsuarioCustomer } from '../../models/db_coresys_v1/catalogo.usuarios.js';

/*========================================
AUTENTIFICAR USUARIO
========================================*/

export const authenticateUser = async (req, res, next) => {

    const LOGIN_URL_LOGIN = envData.login.api_url;

    const { key } = req.body;

    const url = `${LOGIN_URL_LOGIN}/users/token/${key}`;

    try {

        const response = await axios.get(url);

        if(response.data.success){

            const payload = await validateLoginToken(response.data.token);
            const idUsuario = payload?.idUser ?? payload?.id_usuario ?? null;
            const customer = idUsuario ? await getUsuarioCustomer(idUsuario) : null;
            const tokenPayload = {
                ...payload,
                customer_code: customer?.customer_code || null,
                customer_name: customer?.customer_name || null,
            };

            const token = await signToken(tokenPayload);

            res.json({
                success: true,
                token: token
            })

        }

    } catch (err) {

        res.status(500).json({ error: err.message });

    }

}

export const authenticatePortalClient = async (req, res, next) => {

    try {
        const email = req.body?.email ? String(req.body.email).trim() : null;
        const password = req.body?.password ? String(req.body.password) : null;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'email y password son requeridos',
            });
        }

        const user = await getPortalClientUserByEmail(email);
        const passwordHash = crypto
            .createHash('md5')
            .update(password)
            .digest('hex');
        const storedPasswordHash = user?.password ? String(user.password).trim().toLowerCase() : null;

        if (!user || storedPasswordHash !== passwordHash) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales invalidas',
            });
        }

        const payload = {
            id_usuario: user.id_usuario,
            nombres: user.nombres,
            apellidos: user.apellidos,
            email: user.email,
            customer_code: user.customer_code,
            customer_name: user.customer_name,
            portal_groud_id: user.portal_groud_id
        };
        const token = signPortalClientToken(payload);

        if (!token) {
            return res.status(500).json({
                success: false,
                message: 'No se pudo firmar el token',
            });
        }

        return res.json({
            success: true,
            token,
            user: payload,
        });
    } catch (error) {
        return next(error);
    }

};
