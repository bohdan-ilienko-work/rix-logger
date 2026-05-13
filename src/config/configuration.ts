export default () => ({
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    bot: {
        token: process.env.BOT_TOKEN ?? '',
        username: process.env.BOT_USERNAME ?? '',
        miniAppUrl: process.env.MINI_APP_URL ?? '',
    },
    database: {
        url: process.env.DATABASE_URL ?? '',
    },
    miniapp: {
        // When set, requests with empty initData are allowed (dev only)
        devUserId: process.env.MINIAPP_DEV_USER_ID ?? '',
    },
});
