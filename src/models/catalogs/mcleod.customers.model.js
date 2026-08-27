import { executeSp } from '../../config/db/db.portal.config.js';

export const getMcleodCustomersSelect = async () => {

    const resultSets = await executeSp('sysebtapps_prd_mcleod.sp_customers_get_select');
    const customers = resultSets.find((resultSet) => Array.isArray(resultSet)) || [];

    return [
        {
            value: 'EBT',
            label: 'ELITE BORDER LOGISTICS',
        },
        ...customers,
    ];

};
