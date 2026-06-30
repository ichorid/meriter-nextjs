'use client';

import {
  hasMemberQuotaDisplay,
  memberQuotaDisplayFromApi,
  type MemberQuotaDisplay,
} from '@/hooks/api/useWallet';

export type { MemberQuotaDisplay };

/**
 * Assert/map getCommunityMembers quota for member list display.
 * Uses settings.dailyEmission vocabulary (P-3); dailyQuota retired in this path.
 */
export function communityMemberQuotaDisplay(
  quota:
    | {
        dailyEmission?: number;
        usedToday?: number;
        remainingToday?: number;
      }
    | undefined,
): MemberQuotaDisplay | undefined {
  return memberQuotaDisplayFromApi(quota);
}

export { hasMemberQuotaDisplay, memberQuotaDisplayFromApi };
