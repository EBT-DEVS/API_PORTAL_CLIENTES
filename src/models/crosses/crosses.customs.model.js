import { executeSp } from '../../config/db/db.portal.config.js';

export const upsertCrossCustoms = async ({
    cross_stop_id,
    customs_country,
    light = null,
    papers_ready = 0,
    comments = null,
} = {}) => {

    await executeSp('sp__cross_customs_upsert', [
        cross_stop_id,
        customs_country,
        light,
        papers_ready,
        comments,
    ]);

    return {
        cross_stop_id,
        customs_country,
        light,
        papers_ready,
        comments,
    };

};
