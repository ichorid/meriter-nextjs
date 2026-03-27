import { DECREE_809_TAGS } from '@meriter/shared-types';

/**
 * Single superadmin recreated after platform wipe (all other users deleted).
 * Sign in via email OTP using this address.
 */
export const PLATFORM_WIPE_SUPERADMIN = {
  email: 'dmitrsosnin@gmail.com',
  displayName: 'Дмитрий Соснин',
  firstName: 'Дмитрий',
  lastName: 'Соснин',
  /** Stable username for the bootstrap account (email auth). */
  username: 'dmitrsosnin',
  /** profile.bio after wipe */
  bio: 'Команда Меритер: технический администратор',
} as const;

/**
 * Canonical defaults for priority hubs and global community.
 * Used by CommunityService.ensureBaseCommunities and post-wipe reset (must stay in sync).
 */
export const PRIORITY_HUB_BOOTSTRAP = {
  'future-vision': {
    name: 'Образы будущего',
    description:
      'На этой странице вы видите Образы Будущего, к которым стремятся сообщества нашей платформы. По сути, это список всех сообществ, представляющий их прежде всего через их ценности.',
    settings: {
      currencyNames: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      dailyEmission: 0,
      allowWithdraw: false,
    },
  },
  'marathon-of-good': {
    name: 'Биржа',
    description:
      'Биржа социальных инвестиций: посты, обсуждения и инвестиции в идеи (Марафон добра).',
    settings: {
      currencyNames: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      dailyEmission: 10,
      allowWithdraw: true,
      investingEnabled: true,
    },
  },
  'team-projects': {
    name: 'Проекты',
    description: 'Хаб командных проектов и публикаций проектов.',
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
