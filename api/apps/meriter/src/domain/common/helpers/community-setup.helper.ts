/**
 * Pure helper for community onboarding/setup status (no Nest/framework deps).
 */
export type CommunitySetupStatusDetails = {
  hasNoHashtags: boolean;
  hasNoSingular: boolean;
  hasNoPlural: boolean;
  hasNoGenitive: boolean;
  hasNoDailyEmission: boolean;
  needsSetup: boolean;
};

type CommunitySetupInput = {
  hashtags?: string[];
  settings?: {
    currencyNames?: {
      singular?: string;
      plural?: string;
      genitive?: string;
    };
    dailyEmission?: number | null;
  };
};

export function calculateCommunityNeedsSetup(
  community: CommunitySetupInput,
  detailed: false,
): boolean;
export function calculateCommunityNeedsSetup(
  community: CommunitySetupInput,
  detailed: true,
): CommunitySetupStatusDetails;
export function calculateCommunityNeedsSetup(
  community: CommunitySetupInput,
  detailed: boolean = false,
): boolean | CommunitySetupStatusDetails {
  const hasNoHashtags = !community.hashtags || community.hashtags.length === 0;
  const hasNoSingular = !community.settings?.currencyNames?.singular;
  const hasNoPlural = !community.settings?.currencyNames?.plural;
  const hasNoGenitive = !community.settings?.currencyNames?.genitive;
  const hasNoDailyEmission =
    typeof community.settings?.dailyEmission !== 'number' ||
    community.settings?.dailyEmission == null;

  const needsSetup =
    hasNoSingular || hasNoPlural || hasNoGenitive || hasNoDailyEmission;

  if (detailed) {
    return {
      hasNoHashtags,
      hasNoSingular,
      hasNoPlural,
      hasNoGenitive,
      hasNoDailyEmission,
      needsSetup,
    };
  }

  return needsSetup;
}

/** @deprecated Use calculateCommunityNeedsSetup */
export const CommunitySetupHelpers = {
  calculateNeedsSetup: calculateCommunityNeedsSetup,
  calculateSetupStatusDetails: (community: CommunitySetupInput) =>
    calculateCommunityNeedsSetup(community, true),
};
