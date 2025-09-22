export const Bots: {
    telegram: {
        [key: string]: {
            token: string | undefined
        }
    }
} = {
    telegram: {
        '@meritterrabot': {
            token: process.env.TELEGRAM_BOT_TOKEN_MERITTERRABOT,
        },
        '@meriterrabot': {
            token: process.env.TELEGRAM_BOT_TOKEN_MERITERRABOT,
        },
    },
}
