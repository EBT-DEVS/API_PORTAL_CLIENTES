import { getMcleodCustomersSelect } from '../../models/catalogs/mcleod.customers.model.js';

export const getCatMcleodCustomers = async (req, res, next) => {

    try {
        const customers = await getMcleodCustomersSelect();

        return res.json({
            success: true,
            data: customers,
        });
    } catch (error) {
        return next(error);
    }

};
