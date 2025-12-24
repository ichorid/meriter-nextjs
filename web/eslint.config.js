const path = require('path');
const tseslint = require(
    path.join(__dirname, '../api/node_modules/@typescript-eslint/eslint-plugin/dist/index.js'),
);
const tsparser = require(
    path.join(__dirname, '../api/node_modules/@typescript-eslint/parser/dist/index.js'),
);

module.exports = [
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
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
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
