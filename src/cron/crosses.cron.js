import cron from 'node-cron';

import env from '../config/env/env.config.js';
import { runCrossesInitJob } from '../jobs/crosses/crossesInit.job.js';
import { runCrossesUpdateJob } from '../jobs/crosses/crossesUpdate.job.js';

const CROSSES_INIT_SCHEDULE = '*/20 * * * *';
const CROSSES_UPDATE_CACHE_SCHEDULE = '*/10 * * * *';
const CROSSES_UPDATE_REFETCH_SCHEDULE = '0 * * * *';

export const startCrossesInitCron = () => {

    const timezone = env.cron.timezone || 'America/Chicago';
    const company = env.cron.crossings.company || 'ebt';
    const lookbackHours = env.cron.crossings.lookbackHours;

    if (!cron.validate(CROSSES_INIT_SCHEDULE)) {
        throw new Error(`CROSSES_INIT_SCHEDULE invalido: ${CROSSES_INIT_SCHEDULE}`);
    }

    cron.schedule(
        CROSSES_INIT_SCHEDULE,
        () => runCrossesInitJob({
            company,
            lookbackHours,
        }),
        { timezone }
    );

    console.log(`[cron] crosses init activo (${CROSSES_INIT_SCHEDULE}, ${timezone}, ${company})`);

};

export const startCrossesUpdateCron = () => {

    const timezone = env.cron.timezone || 'America/Chicago';
    const company = env.cron.crossings.company || 'ebt';

    if (!cron.validate(CROSSES_UPDATE_CACHE_SCHEDULE)) {
        throw new Error(`CROSSES_UPDATE_CACHE_SCHEDULE invalido: ${CROSSES_UPDATE_CACHE_SCHEDULE}`);
    }

    if (!cron.validate(CROSSES_UPDATE_REFETCH_SCHEDULE)) {
        throw new Error(`CROSSES_UPDATE_REFETCH_SCHEDULE invalido: ${CROSSES_UPDATE_REFETCH_SCHEDULE}`);
    }

    cron.schedule(
        CROSSES_UPDATE_CACHE_SCHEDULE,
        () => runCrossesUpdateJob({
            company,
            refetchAssignments: false,
        }),
        { timezone }
    );

    cron.schedule(
        CROSSES_UPDATE_REFETCH_SCHEDULE,
        () => runCrossesUpdateJob({
            company,
            refetchAssignments: true,
        }),
        { timezone }
    );

    console.log(`[cron] crosses update cache activo (${CROSSES_UPDATE_CACHE_SCHEDULE}, ${timezone}, ${company})`);
    console.log(`[cron] crosses update refetch activo (${CROSSES_UPDATE_REFETCH_SCHEDULE}, ${timezone}, ${company})`);

};
