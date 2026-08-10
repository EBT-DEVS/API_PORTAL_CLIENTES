import 'dotenv/config';

const envData = {
    nodeEnv : process.env.NODE_ENV || 'development',
    port    : Number(process.env.API_PORT) || 3000,
    db: {
        host               : process.env.DB_HOST ,
        port               : Number(process.env.DB_PORT),
        user               : process.env.DB_USER,
        password           : process.env.DB_PASSWORD,
        database           : process.env.DB_NAME,
        waitForConnections : true,
        connectionLimit    : Number(process.env.DB_CONNECTION_LIMIT),
        queueLimit         : Number(process.env.DB_QUEUE_LIMIT),
    },
    tokens: {
        secret     : process.env.API_TOKEN_CUSTOMER_SECRET,
        expiration : Number(process.env.API_TOKEN_CUSTOMER_EXPIRATION),
    },
    login: {
        api_url    :    process.env.LOGIN_API_URL,
        api_secret : process.env.LOGIN_API_SECRET,
    },
    mcleod: {
        url      : process.env.MCLEOD_API_URL,
        token    : process.env.MCLEOD_API_TOKEN,
        user     : process.env.MCLEOD_API_USER,
        password : process.env.MCLEOD_API_PASS,
    },
    pcMiller: {
        url   : process.env.PC_MILLER_API_URL,
        token : process.env.PC_MILLER_API_TOKEN,
    },
    cron: {
        timezone: process.env.CRON_TIMEZONE,
        crossings: {
            enabled       : process.env.CROSSINGS_CRON_ENABLED,
            schedule      : process.env.CROSSINGS_CRON_SCHEDULE ,
            company       : process.env.CROSSINGS_MCLEOD_COMPANY,
            lookbackHours : Number(process.env.CROSSINGS_LOOKBACK_HOURS),
        },
        notifications: {
            enabled: process.env.NOTIFICATIONS_CRON_ENABLED,
        },
    }
}

export default envData;
