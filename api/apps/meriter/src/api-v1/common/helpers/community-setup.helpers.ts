/**
 * Helper utilities for community setup status calculation
 */
export class CommunitySetupHelpers {
  /**
   * Calculate whether a community needs setup based on missing essential configurations
   * A community needs setup if it's missing essential configurations.
   * Note: Having default currency name "merit" is NOT considered needing setup
   * 
   * @param community The community to check
   * @param detailed If true, returns object with individual check results; if false, returns boolean
   * @returns boolean indicating if setup is needed, or object with detailed breakdown if detailed=true
   */
  static calculateNeedsSetup(
    community: any,
    detailed: false
  ): boolean;
  static calculateNeedsSetup(
    community: any,
    detailed: true
  ): {
    hasNoHashtags: boolean;
    hasNoSingular: boolean;
    hasNoPlural: boolean;
    hasNoGenitive: boolean;
    hasNoDailyEmission: boolean;
    needsSetup: boolean;
  };
  static calculateNeedsSetup(
    community: any,
    detailed: boolean = false
  ): boolean | {
    hasNoHashtags: boolean;
    hasNoSingular: boolean;
    hasNoPlural: boolean;
    hasNoGenitive: boolean;
    hasNoDailyEmission: boolean;
    needsSetup: boolean;
  } {
    const hasNoHashtags = !community.hashtags || community.hashtags.length === 0;
    const hasNoSingular = !community.settings?.currencyNames?.singular;
    const hasNoPlural = !community.settings?.currencyNames?.plural;
    const hasNoGenitive = !community.settings?.currencyNames?.genitive;
    const hasNoDailyEmission = typeof community.settings?.dailyEmission !== 'number' ||
      community.settings?.dailyEmission == null;

    // Hashtags are now optional - only check currency and emission settings
    const needsSetup = hasNoSingular || hasNoPlural || hasNoGenitive || hasNoDailyEmission;

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

  /**
   * Calculate setup status with detailed breakdown for logging
   * @deprecated Use calculateNeedsSetup(community, true) instead
   * @param community The community to check
   * @returns Object with individual check results and overall needsSetup flag
   */
  static calculateSetupStatusDetails(community: any): {
    hasNoHashtags: boolean;
    hasNoSingular: boolean;
    hasNoPlural: boolean;
    hasNoGenitive: boolean;
    hasNoDailyEmission: boolean;
    needsSetup: boolean;
  } {
    return this.calculateNeedsSetup(community, true) as {
      hasNoHashtags: boolean;
      hasNoSingular: boolean;
      hasNoPlural: boolean;
      hasNoGenitive: boolean;
      hasNoDailyEmission: boolean;
      needsSetup: boolean;
    };
  }
}

