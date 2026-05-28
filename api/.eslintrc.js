module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'import'],
  extends: ['plugin:@typescript-eslint/recommended'],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: 'tsconfig.json',
      },
    },
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-restricted-imports': ['warn', {
      paths: [{
        name: '@meriter/shared-types',
        importNames: [
          'PublicationSchema', 'WalletSchema', 'PollSchema', 'CommunitySchema',
          'UserSchema', 'VoteSchema', 'CommentSchema', 'TransactionSchema',
          'NotificationSchema', 'PublicationCreateInputSchema', 'PublicationUpdateInputSchema',
          'WalletCreateInputSchema', 'CommunityCreateInputSchema', 'CommunityUpdateInputSchema',
          'PollCreateInputSchema', 'FeedItemSchema', 'ResourcePermissionsSchema',
        ],
        message: 'P0-3: Domain zone-6 allowlist — forbidden god-object schema exports from barrel (17 symbols in p0_3_forbidden_import_names). V-13 drift symbols are NOT whitelisted — use Phase 1 Option B subpaths (zone 6 except list); monolithic schemas.ts not allowlisted.',
      }],
    }],
    'import/no-restricted-paths': ['warn', {
      zones: [
        {
          target: './apps/meriter/src/domain/**',
          from: './apps/meriter/src/trpc/**',
          message: 'Zone 1: Domain must not import tRPC (V-01). Use application use case.',
        },
        {
          target: './apps/meriter/src/domain/**',
          from: './apps/meriter/src/api-v1/**',
          message: 'Zone 2: Domain must not import api-v1 adapters.',
        },
        {
          target: './apps/meriter/src/application/**',
          from: './apps/meriter/src/trpc/**',
          message: 'Zone 3: Use cases must not import routers.',
        },
        {
          target: './apps/meriter/src/application/**',
          from: './apps/meriter/src/api-v1/**',
          message: 'Zone 4: Use cases must not import api-v1.',
        },
        {
          target: './apps/meriter/src/application/**',
          from: '@nestjs/mongoose',
          message: 'Zone 5: Use cases must not import @nestjs/mongoose.',
        },
        {
          target: './apps/meriter/src/domain/**',
          from: '@meriter/shared-types',
          except: [
            './libs/shared-types/src/decree809-tag-remap.ts',
            './libs/shared-types/src/demo-event-seed-targets.ts',
            './libs/shared-types/src/events.ts',
            './libs/shared-types/src/merit-transfer.ts',
            './libs/shared-types/src/schemas/**',
            './libs/shared-types/src/tappalka.ts',
            './libs/shared-types/src/taxonomy.ts',
            './libs/shared-types/src/value-objects/**',
            './libs/shared-types/src/value-rubricator.ts',
          ],
          message: 'Zone 6: Domain shared-types allowlist only — Phase 1 Option B subpaths (no monolithic schemas.ts).',
        },
        {
          target: './apps/meriter/src/infrastructure/**',
          from: './apps/meriter/src/api-v1/**',
          except: [
            './apps/meriter/src/infrastructure/permissions/permission-gates.adapter.ts',
          ],
          message: 'Zone 7: Infrastructure→api-v1 only via permission-gates.adapter.ts (V-11).',
        },
        {
          target: './apps/meriter/src/domain/**',
          from: './apps/meriter/src/application/**',
          message: 'Zone 8: Domain must not import application layer (dep-inward-only).',
        },
        {
          target: './apps/meriter/src/trpc/routers/**',
          from: './apps/meriter/src/trpc/routers/**',
          except: [
            './apps/meriter/src/trpc/routers/votes.router.ts',
          ],
          message: 'Zone 9: Routers must not import other routers (V-03). Only yaml zone_9_interim_pairs.',
        },
      ],
    }],
  },
};
