const withNextIntl = require('next-intl/plugin')(
    // This is the default (also the `src` folder is supported out of the box)
    './src/i18n/request.ts'
);
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    // For App Router
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
    transpilePackages: ['@telegram-apps/sdk-react', '@telegram-apps/telegram-ui', '@meriter/shared-types'],
    output: 'standalone',
    // Fix monorepo/workspace output tracing root
    outputFileTracingRoot: path.join(__dirname, '..'),
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            '@meriter/shared-types': path.resolve(__dirname, '../libs/shared-types/dist/index'),
        };
        return config;
    },
};

module.exports = withNextIntl(nextConfig);
