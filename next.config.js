module.exports = {
    publicRuntimeConfig: {
        APP_ENV: process.env.APP_ENV,
    },
    async rewrites() {
        return [
            {
                source: "/mt/:link*",
                destination: "/meriter/:link*",
            },
        ];
    },
};
