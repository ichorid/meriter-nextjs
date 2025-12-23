const withNextIntl = require('next-intl/plugin')(
    // This is the default (also the `src` folder is supported out of the box)
    './src/i18n/request.ts'
);
const { withGluestackUI } = require('@gluestack/ui-next-adapter');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    // Re-enable strict type checking now that shared types have been trimmed for memory safety
    typescript: {
        ignoreBuildErrors: false,
    },
    // Skip ESLint during build to reduce memory usage
    eslint: {
        ignoreDuringBuilds: true,
    },
    // Static export configuration - no server-side features
    // Optimize memory usage during build
    experimental: {
        optimizePackageImports: ['@gluestack-ui/themed', '@gluestack-style/react'],
    },
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
        '@gluestack-ui/themed',
        '@gluestack-ui/config',
        '@gluestack-ui/overlay',
        '@gluestack-ui/provider',
        '@gluestack-ui/toast',
        '@gluestack-ui/slider',
        '@gluestack-ui/form-control',
        '@gluestack-style/react',
        '@gluestack/ui-next-adapter',
        '@expo/html-elements',
        '@react-native/assets-registry',
        'react-native',
        'react-native-web',
        'react-native-safe-area-context',
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
            // Fix for React Native modules in Next.js
            'react-native$': 'react-native-web',
        };
        
        // Note: React externalization is handled by Next.js default behavior
        // For standalone builds, React should be installed in the Docker runner stage
        // This is more efficient than bundling React and follows Next.js best practices

        // Extensions for React Native
        config.resolve.extensions = [
            '.web.js',
            '.web.jsx',
            '.web.ts',
            '.web.tsx',
            ...config.resolve.extensions,
        ];

        // Define __DEV__ for React Native Web compatibility
        // Check if DefinePlugin already exists and merge, otherwise create new one
        const webpack = require('webpack');
        const existingDefinePlugin = config.plugins.find(
            plugin => plugin && plugin.constructor && plugin.constructor.name === 'DefinePlugin'
        );

        if (existingDefinePlugin) {
            // Merge __DEV__ into existing DefinePlugin
            const existingDefinitions = existingDefinePlugin.definitions || {};
            existingDefinePlugin.definitions = {
                ...existingDefinitions,
                __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
            };
        } else {
            // Create new DefinePlugin if none exists
            config.plugins = config.plugins || [];
            config.plugins.push(
                new webpack.DefinePlugin({
                    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
                })
            );
        }

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

        // Add rule to handle @gluestack-ui/* packages with JSX
        // Use enforce: 'pre' to ensure it runs before SWC
        config.module.rules.unshift({
            enforce: 'pre',
            test: /\.(tsx?|jsx?)$/,
            include: [
                /node_modules[\/\\]@gluestack-ui/,
                /node_modules[\/\\]\.pnpm[\/\\].*@gluestack-ui/,
            ],
            exclude: /\.d\.ts$/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: [
                        '@babel/preset-env',
                        ['@babel/preset-react', { runtime: 'automatic' }],
                        '@babel/preset-typescript',
                    ],
                    cacheDirectory: true,
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

            // Insert babel-loader rules at the very beginning of oneOf array
            // First, exclude @gluestack-ui from SWC rules
            oneOfRule.oneOf = oneOfRule.oneOf.map((rule) => {
                if (!rule || typeof rule !== 'object') return rule;
                // Check if rule uses SWC or next-flight loaders
                const usesSWC = rule.use && (
                    (Array.isArray(rule.use) && rule.use.some(u => {
                        if (!u) return false;
                        const loader = typeof u === 'string' ? u : (u.loader || '');
                        return loader.includes('swc') || loader.includes('next-flight') || loader.includes('next-swc');
                    })) ||
                    (typeof rule.use === 'object' && rule.use.loader && (
                        rule.use.loader.includes('swc') ||
                        rule.use.loader.includes('next-flight') ||
                        rule.use.loader.includes('next-swc')
                    )) ||
                    (typeof rule.use === 'string' && (
                        rule.use.includes('swc') ||
                        rule.use.includes('next-flight') ||
                        rule.use.includes('next-swc')
                    ))
                );
                if (usesSWC) {
                    // Add exclude for @gluestack-ui to all SWC/next-flight rules
                    const gluestackExclude = [
                        /[\/\\]@gluestack-ui[\/\\]/,
                        /[\/\\]\.pnpm[\/\\].*@gluestack-ui[\/\\]/,
                    ];
                    const newExclude = Array.isArray(rule.exclude)
                        ? [...rule.exclude, ...gluestackExclude]
                        : rule.exclude
                            ? [rule.exclude, ...gluestackExclude]
                            : gluestackExclude;
                    return { ...rule, exclude: newExclude };
                }
                return rule;
            });

            // Insert babel-loader rule for @react-native/assets-registry
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

            // Insert babel-loader rule for @gluestack-ui at the very beginning
            oneOfRule.oneOf.unshift({
                test: /\.(tsx?|jsx?)$/,
                include: [
                    /[\/\\]@gluestack-ui[\/\\]/,
                    /[\/\\]\.pnpm[\/\\].*@gluestack-ui[\/\\]/,
                ],
                exclude: /\.d\.ts$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            '@babel/preset-env',
                            ['@babel/preset-react', { runtime: 'automatic' }],
                            '@babel/preset-typescript',
                        ],
                        cacheDirectory: true,
                    },
                },
            });
        }

        return config;
    },
};

module.exports = withGluestackUI(withNextIntl(nextConfig));
