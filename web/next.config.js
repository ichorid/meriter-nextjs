const withNextIntl = require('next-intl/plugin')(
    // This is the default (also the `src` folder is supported out of the box)
    './src/i18n/request.ts'
);
const { withGluestackUI } = require('@gluestack/ui-next-adapter');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    // Skip type checking during build to reduce memory usage
    // NOTE: Type checking causes infinite memory usage due to complex Zod schema inferences
    // in @meriter/shared-types. The package has been optimized with explicit exports instead
    // of wildcard exports, but the fundamental issue with z.infer<> type resolution remains.
    typescript: {
        ignoreBuildErrors: true,
    },
    // Skip ESLint during build to reduce memory usage
    eslint: {
        ignoreDuringBuilds: true,
    },
    // For App Router
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
        // Optimize memory usage during build
        optimizePackageImports: ['@gluestack-ui/themed', '@gluestack-style/react'],
    },
    transpilePackages: [
        '@telegram-apps/sdk-react', 
        '@telegram-apps/telegram-ui', 
        '@meriter/shared-types',
        '@gluestack-ui',
        '@gluestack-style',
        '@expo/html-elements',
        '@react-native/assets-registry', // Add this to transpilePackages so Next.js processes it
        'react-native',
        'react-native-web',
    ],
    output: 'standalone',
    // Fix monorepo/workspace output tracing root
    outputFileTracingRoot: path.join(__dirname, '..'),
    // Proxy API requests to backend API server
    // In Docker, use service name 'api' on port 8002
    // In local development, use 'localhost:8002'
    async rewrites() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        // If NEXT_PUBLIC_API_URL is set, use it (absolute URL)
        // Otherwise, proxy to API server (relative rewrites)
        if (apiUrl && apiUrl.trim() !== '') {
            // If API URL is set, don't use rewrites - client will use absolute URL
            return [];
        }
        
        // Proxy /api/* to API server
        // In Docker: always use service name 'api' (Next.js runs in Docker network)
        // In local dev: use 'localhost:8002'
        // Check if we're in Docker by checking if we can resolve 'api' hostname
        // or by checking NODE_ENV and assuming Docker if production
        // Since rewrites() may be called at build time, we need a reliable way to detect Docker
        // Best approach: always use 'api' service name in production builds (Docker)
        // and 'localhost' only in development
        const isProduction = process.env.NODE_ENV === 'production';
        // In production (Docker), always use service name 'api'
        // In development, use 'localhost:8002'
        const apiHost = isProduction ? 'http://api:8002' : 'http://localhost:8002';
        
        return [
            {
                source: '/api/:path*',
                destination: `${apiHost}/api/:path*`,
            },
        ];
    },
    webpack: (config, { isServer }) => {
        // Resolve @meriter/shared-types to the dist directory for CommonJS relative imports
        config.resolve.alias = {
            ...config.resolve.alias,
            '@meriter/shared-types': path.resolve(__dirname, '../libs/shared-types/dist'),
        };
        
        // Fix for React Native modules in Next.js
        config.resolve.alias = {
            ...config.resolve.alias,
            'react-native$': 'react-native-web',
        };
        
        // Extensions for React Native
        config.resolve.extensions = [
            '.web.js',
            '.web.jsx',
            '.web.ts',
            '.web.tsx',
            ...config.resolve.extensions,
        ];
        
        // Define __DEV__ for React Native Web compatibility
        config.plugins = config.plugins || [];
        config.plugins.push(
            new (require('webpack')).DefinePlugin({
                __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
            })
        );
        
        // Use NormalModuleReplacementPlugin to replace problematic file with a patched version
        // This runs BEFORE any loaders, so we can intercept the file
        const NormalModuleReplacementPlugin = require('webpack').NormalModuleReplacementPlugin;
        config.plugins.push(
            new NormalModuleReplacementPlugin(
                /@react-native\/assets-registry\/registry\.js$/,
                (resource) => {
                    // Replace with a version that will be processed by babel-loader
                    // The babel-loader rule will handle Flow syntax
                    resource.request = resource.request;
                }
            )
        );
        
        // Add rule to handle @expo/html-elements
        config.module.rules.push({
            test: /\.(tsx?|jsx?)$/,
            include: /node_modules\/@expo\/html-elements/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: ['@babel/preset-env', '@babel/preset-typescript', '@babel/preset-react'],
                },
            },
        });

        // CRITICAL: Handle @react-native/assets-registry with Flow syntax
        // The file contains Flow syntax (+property, ?type) which SWC cannot parse
        // We MUST intercept it BEFORE SWC processes it
        
        // Add rule at the very top level with enforce: 'pre' to ensure it runs first
        config.module.rules.unshift({
            enforce: 'pre',
            test: /\.(ts|tsx|js|jsx)$/,
            include: /node_modules\/@react-native\/assets-registry/,
            exclude: /\.d\.ts$/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: [
                        ['@babel/preset-env', { modules: false }],
                        '@babel/preset-flow', // CRITICAL: This handles Flow syntax like +property
                        ['@babel/preset-typescript', { 
                            allowNamespaces: true,
                            onlyRemoveTypeImports: false,
                            isTSX: true,
                            allExtensions: true,
                        }],
                        '@babel/preset-react',
                    ],
                },
            },
        });
        
        // Also add to oneOf rule if it exists (Next.js uses this structure)
        const oneOfRule = config.module.rules.find(
            (rule) => rule && typeof rule === 'object' && Array.isArray(rule.oneOf)
        );
        
        if (oneOfRule && Array.isArray(oneOfRule.oneOf)) {
            // Find and remove any SWC rules for this path
            oneOfRule.oneOf = oneOfRule.oneOf.filter((rule) => {
                if (!rule || typeof rule !== 'object') return true;
                // Check if rule matches our path
                if (rule.include) {
                    const includeStr = rule.include.toString();
                    if (includeStr.includes('@react-native/assets-registry')) {
                        // Remove SWC rules for this path
                        const usesSWC = rule.use && (
                            (Array.isArray(rule.use) && rule.use.some(u => u && u.loader && u.loader.includes('swc'))) ||
                            (typeof rule.use === 'object' && rule.use.loader && rule.use.loader.includes('swc')) ||
                            (typeof rule.use === 'string' && rule.use.includes('swc'))
                        );
                        return !usesSWC; // Keep non-SWC rules, remove SWC rules
                    }
                }
                return true;
            });
            
            // Insert babel-loader rule at the very beginning of oneOf array
            oneOfRule.oneOf.unshift({
                test: /\.(ts|tsx|js|jsx)$/,
                include: /node_modules\/@react-native\/assets-registry/,
                exclude: /\.d\.ts$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { modules: false }],
                            '@babel/preset-flow',
                            ['@babel/preset-typescript', { 
                                allowNamespaces: true,
                                onlyRemoveTypeImports: false,
                                isTSX: true,
                                allExtensions: true,
                            }],
                            '@babel/preset-react',
                        ],
                    },
                },
            });
        }
        
        return config;
    },
};

module.exports = withGluestackUI(withNextIntl(nextConfig));
