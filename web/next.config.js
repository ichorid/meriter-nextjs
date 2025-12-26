const withNextIntl = require('next-intl/plugin')(
    // This is the default (also the `src` folder is supported out of the box)
    './src/i18n/request.ts'
);
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Temporarily allow errors from backend imports (tRPC types) - these are type-only and don't affect runtime
    typescript: {
        // TODO: Stop importing backend source types into the frontend build (generate a types-only artifact instead).
        // Until then, Next's typecheck may traverse backend NestJS code and fail on mismatched tsconfig settings.
        ignoreBuildErrors: true,
    },
    // Enable source maps for debugging in dev builds (works with static export)
    // Note: In Next.js 16+, SWC minification cannot be disabled, but source maps will still work
    // Source maps map minified code back to original source, allowing readable error messages
    productionBrowserSourceMaps: process.env.NEXT_PUBLIC_DEV_BUILD === 'true',
    // Note: OAuth provider flags and AUTHN are fetched from backend at runtime via useRuntimeConfig()
    // No need to expose them as build-time env vars
    transpilePackages: [
        '@telegram-apps/sdk-react',
        '@telegram-apps/telegram-ui',
        '@meriter/shared-types',
        '@expo/html-elements',
    ],
    // Serverful Next.js (Docker) - required for robust dynamic routing and auth flows
    // Used by web/Dockerfile via `.next/standalone`
    output: 'standalone',
    // Fix monorepo/workspace output tracing root
    outputFileTracingRoot: path.join(__dirname, '..'),
    // Ensure server-side fetches to `/api/*` and `/trpc/*` work inside the Docker network.
    // When running behind Caddy, clients still use relative URLs and Caddy routes them.
    async rewrites() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        if (apiUrl && apiUrl.trim() !== '') {
            // If API URL is set, do not proxy via rewrites.
            return [];
        }

        const isProduction = process.env.NODE_ENV === 'production';
        const apiHost = isProduction ? 'http://api:8002' : 'http://localhost:8002';

        return [
            { source: '/api/:path*', destination: `${apiHost}/api/:path*` },
            { source: '/trpc/:path*', destination: `${apiHost}/trpc/:path*` },
        ];
    },
    webpack: (config, { isServer, dev }) => {
        // Check dev mode at runtime (not at config load time)
        const isDevMode = process.env.NEXT_PUBLIC_DEV_BUILD === 'true' || process.env.NODE_ENV === 'development';
        
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

        // Enable dev features for static build
        if (isDevMode && !isServer) {
            console.log('[next.config] Dev mode enabled: disabling minification and enabling source maps');
            
            // Enable source maps for debugging only in dev mode
            config.devtool = 'source-map'; // Full source maps (slower but best quality)
            
            // Disable minification to keep code readable
            if (config.optimization) {
                config.optimization.minimize = false;
                // Disable all minimizers
                config.optimization.minimizer = [];
            } else {
                config.optimization = {
                    minimize: false,
                    minimizer: [],
                };
            }
        } else if (!isServer) {
            console.log('[next.config] Production mode: minification enabled, source maps disabled');
            // Explicitly disable source maps in production to avoid errors
            config.devtool = false;
        }

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
