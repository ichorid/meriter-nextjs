const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
    js.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                // DOM types
                HTMLElement: 'readonly',
                HTMLDivElement: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLTextAreaElement: 'readonly',
                HTMLButtonElement: 'readonly',
                KeyboardEvent: 'readonly',
                MouseEvent: 'readonly',
                TouchEvent: 'readonly',
                Event: 'readonly',
                Element: 'readonly',
                // Browser APIs
                btoa: 'readonly',
                atob: 'readonly',
                fetch: 'readonly',
                URLSearchParams: 'readonly',
                IntersectionObserver: 'readonly',
                DOMException: 'readonly',
                crypto: 'readonly',
                confirm: 'readonly',
                // Node.js globals (for Next.js)
                process: 'readonly',
                global: 'readonly',
                require: 'readonly',
                // React (not needed in React 19, but for compatibility)
                React: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            react: react,
            'react-hooks': reactHooks,
        },
        rules: {
            // Enforce Rules of Hooks - catches conditional hook calls (prevents React error #310)
            'react-hooks/rules-of-hooks': 'error',
            // Warn about missing dependencies in useEffect, useMemo, etc.
            // Set to 'error' in CI to catch infinite loop issues early
            'react-hooks/exhaustive-deps': process.env.CI === 'true' ? 'error' : 'warn',
            // Disable prop-types since we're using TypeScript
            'react/prop-types': 'off',
            // React 19 doesn't require React import in JSX
            'react/react-in-jsx-scope': 'off',
            // Allow any for now (can be tightened later)
            '@typescript-eslint/no-explicit-any': 'warn',
            // Allow unused vars that start with underscore
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    // Ignore parameters in type definitions (they're part of the API contract)
                    ignoreRestSiblings: true,
                },
            ],
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    // Test files configuration
    {
        files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
        languageOptions: {
            globals: {
                jest: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
            },
        },
    },
    // Type definition files - allow unused parameters in function types (they're part of API contract)
    {
        files: ['**/types/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    // In type definitions, parameter names are just documentation
                    args: 'none',
                },
            ],
        },
    },
    {
        ignores: [
            'node_modules/',
            '.next/',
            'out/',
            'dist/',
            'build/',
            'coverage/',
            '*.config.js',
            '*.config.ts',
            'public/',
            'pnpm-lock.yaml',
            'tsconfig.tsbuildinfo',
        ],
    },
];

