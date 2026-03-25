import { DECREE_809_TAGS } from '@meriter/shared-types';

/**
 * Canonical defaults for priority hubs and global community.
 * Used by CommunityService.ensureBaseCommunities and post-wipe reset (must stay in sync).
 */
export const PRIORITY_HUB_BOOTSTRAP = {
  'future-vision': {
    name: 'Образ Будущего',
    description: 'Группа для публикации и обсуждения образов будущего.',
    settings: {
      currencyNames: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      dailyEmission: 10,
      allowWithdraw: false,
    },
  },
  'marathon-of-good': {
    name: 'Марафон Добра',
    description: 'Группа для отчетов о добрых делах.',
    settings: {
      currencyNames: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      dailyEmission: 10,
    },
  },
  'team-projects': {
    name: 'Проекты команд',
    description: 'Группа для публикации проектов команд.',
    settings: {
      currencyNames: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      dailyEmission: 10,
    },
  },
  support: {
    name: 'Поддержка',
    description: 'Группа поддержки.',
    settings: {
      currencyNames: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      dailyEmission: 10,
    },
  },
} as const;

export type PriorityHubBootstrapTag = keyof typeof PRIORITY_HUB_BOOTSTRAP;

export const PRIORITY_HUB_BOOTSTRAP_TYPE_TAGS: PriorityHubBootstrapTag[] = [
  'future-vision',
  'marathon-of-good',
  'team-projects',
  'support',
];

export const GLOBAL_COMMUNITY_BOOTSTRAP = {
  name: 'Global',
  description: 'Platform-wide merit storage for fees and priority communities.',
  settings: {
    currencyNames: {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    },
    dailyEmission: 0,
  },
} as const;

/** Fresh platform_settings row (same as PlatformSettingsService.get() defaults). */
export const PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP = {
  welcomeMeritsGlobal: 100,
  availableFutureVisionTags: [] as string[],
  decree809Enabled: false,
  decree809Tags: [...DECREE_809_TAGS],
  popularValueTagsThreshold: 5,
} as const;
