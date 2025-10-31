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
        // Alias the package to the dist directory so relative imports resolve correctly
        const sharedTypesDist = path.resolve(__dirname, '../libs/shared-types/dist');
        config.resolve.alias = {
            ...config.resolve.alias,
            '@meriter/shared-types': sharedTypesDist,
        };
        // Add the dist directory to modules resolution so webpack can resolve relative CommonJS imports
        config.resolve.modules = [...(config.resolve.modules || []), sharedTypesDist];
        // Ensure .js extensions are resolved for CommonJS
        config.resolve.extensions = [...(config.resolve.extensions || []), '.js'];
        return config;
    },
};

module.exports = withNextIntl(nextConfig);
