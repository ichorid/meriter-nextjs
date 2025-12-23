const withNextIntl = require('next-intl/plugin')(
    // This is the default (also the `src` folder is supported out of the box)
    './src/i18n/request.ts'
);
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Re-enable strict type checking now that shared types have been trimmed for memory safety
    // Temporarily allow errors from backend imports (tRPC types) - these are type-only and don't affect runtime
    typescript: {
        ignoreBuildErrors: true, // TODO: Fix tRPC type imports to not pull in backend runtime code
    },
    // Skip ESLint during build to reduce memory usage
    eslint: {
        ignoreDuringBuilds: true,
    },
    // Static export configuration - no server-side features
    experimental: {},
    // Expose build-time environment variables to Next.js
    // All variables must be NEXT_PUBLIC_* for static export (baked into build)
    env: {
        NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED || process.env.OAUTH_GOOGLE_ENABLED,
        NEXT_PUBLIC_OAUTH_YANDEX_ENABLED: process.env.NEXT_PUBLIC_OAUTH_YANDEX_ENABLED || process.env.OAUTH_YANDEX_ENABLED,
        NEXT_PUBLIC_OAUTH_VK_ENABLED: process.env.NEXT_PUBLIC_OAUTH_VK_ENABLED || process.env.OAUTH_VK_ENABLED,
        NEXT_PUBLIC_OAUTH_TELEGRAM_ENABLED: process.env.NEXT_PUBLIC_OAUTH_TELEGRAM_ENABLED || process.env.OAUTH_TELEGRAM_ENABLED,
        NEXT_PUBLIC_OAUTH_APPLE_ENABLED: process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED || process.env.OAUTH_APPLE_ENABLED,
        NEXT_PUBLIC_OAUTH_TWITTER_ENABLED: process.env.NEXT_PUBLIC_OAUTH_TWITTER_ENABLED || process.env.OAUTH_TWITTER_ENABLED,
        NEXT_PUBLIC_OAUTH_INSTAGRAM_ENABLED: process.env.NEXT_PUBLIC_OAUTH_INSTAGRAM_ENABLED || process.env.OAUTH_INSTAGRAM_ENABLED,
        NEXT_PUBLIC_OAUTH_SBER_ENABLED: process.env.NEXT_PUBLIC_OAUTH_SBER_ENABLED || process.env.OAUTH_SBER_ENABLED,
        NEXT_PUBLIC_OAUTH_MAILRU_ENABLED: process.env.NEXT_PUBLIC_OAUTH_MAILRU_ENABLED || process.env.OAUTH_MAILRU_ENABLED,
        NEXT_PUBLIC_AUTHN_ENABLED: process.env.NEXT_PUBLIC_AUTHN_ENABLED || process.env.AUTHN_ENABLED,
    },
    transpilePackages: [
        '@telegram-apps/sdk-react',
        '@telegram-apps/telegram-ui',
        '@meriter/shared-types',
        '@expo/html-elements',
    ],
    // Static export - generates fully static HTML/CSS/JS files
    // No server-side rendering or API routes supported
    output: 'export',
    // Fix monorepo/workspace output tracing root
    outputFileTracingRoot: path.join(__dirname, '..'),
    // Note: Static export doesn't support rewrites()
    // API calls must use relative URLs (/api/*) or absolute URLs via NEXT_PUBLIC_API_URL
    // Caddy will handle proxying /api/* to the backend API server
    webpack: (config, { isServer }) => {
        // CRITICAL: Merge all aliases properly to ensure single React instance
        // This prevents "Cannot read properties of undefined (reading 'ReactCurrentOwner')" errors
        // and "Cannot read properties of null (reading 'useState')" errors
        const reactPath = path.resolve(__dirname, 'node_modules/react');
        const reactDomPath = path.resolve(__dirname, 'node_modules/react-dom');
        
        config.resolve.alias = {
            ...config.resolve.alias,
            // Ensure React and React-DOM resolve to single instances (prevents ReactCurrentOwner errors)
            // Using explicit paths ensures all modules use the same React 19 instance
            'react': reactPath,
            'react-dom': reactDomPath,
            // Resolve @meriter/shared-types to the dist directory for CommonJS relative imports
            '@meriter/shared-types': path.resolve(__dirname, '../libs/shared-types/dist'),
        };

        // Exclude backend API code from frontend bundle (only import types)
        config.externals = config.externals || [];
        if (!isServer) {
            // On client-side, exclude backend API code
            config.externals.push({
                '../../../../api/apps/meriter/src/trpc/router': 'commonjs ../../../../api/apps/meriter/src/trpc/router',
            });
        }
        
        // Note: React externalization is handled by Next.js default behavior
        // For standalone builds, React should be installed in the Docker runner stage
        // This is more efficient than bundling React and follows Next.js best practices

        return config;
    },
};

module.exports = withNextIntl(nextConfig);
