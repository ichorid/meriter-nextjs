import { DECREE_809_TAGS } from '@meriter/shared-types';
import type {
  CommunityMeritSettings,
  CommunityTappalkaSettings,
} from '../../models/community/community.schema';

/** Display name for marathon-of-good hub after wipe / in bootstrap snapshot. */
export const MARATHON_HUB_DISPLAY_NAME = 'Биржа социальных инвестиций';

/** Tappalka on for Биржа, full decree 809 rubricator. */
export const MARATHON_HUB_DEFAULT_TAPPAKLA: CommunityTappalkaSettings = {
  enabled: true,
  categories: [...DECREE_809_TAGS],
  winReward: 1,
  userReward: 1,
  comparisonsRequired: 10,
  showCost: 0.1,
  minRating: 1,
};

/** Quota / merit “mining” on for Биржа. */
export const MARATHON_HUB_DEFAULT_MERIT: CommunityMeritSettings = {
  dailyQuota: 10,
  quotaRecipients: ['superadmin', 'lead', 'participant'],
  canEarn: true,
  canSpend: true,
  startingMerits: 10,
  quotaEnabled: true,
};
