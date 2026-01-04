import { Injectable } from '@nestjs/common';
import { CommunityService } from './community.service';
import { UserService } from './user.service';
import { PermissionService } from './permission.service';
import { WalletService } from './wallet.service';
import { COMMUNITY_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD } from '../common/constants/roles.constants';

/**
 * MeritService
 *
 * Service for managing merits based on community configuration.
 * All merit operations use meritRules from community configuration.
 */
@Injectable()
export class MeritService {
  constructor(
    private communityService: CommunityService,
    private userService: UserService,
    private permissionService: PermissionService,
    private walletService: WalletService,
  ) {}

  /**
   * Check if user can spend merits in a community
   * Uses meritRules.canSpend from community configuration
   */
  async canSpendMerits(userId: string, communityId: string): Promise<boolean> {
    const userRole = await this.permissionService.getUserRoleInCommunity(
      userId,
      communityId,
    );

    // Superadmin always can
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return false;

    const rules = this.communityService.getEffectiveMeritSettings(community);

    // Check if role can spend
    if (!rules.canSpend) return false;

    // Check if role is in quotaRecipients (can spend from quota)
    return rules.quotaRecipients.includes(userRole as any);
  }

  /**
   * Check if user can earn merits in a community
   * Uses meritRules.canEarn from community configuration
   */
  async canEarnMerits(userId: string, communityId: string): Promise<boolean> {
    const userRole = await this.permissionService.getUserRoleInCommunity(
      userId,
      communityId,
    );

    // Superadmin always can
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return false;

    const rules = this.communityService.getEffectiveMeritSettings(community);

    return rules.canEarn;
  }

  /**
   * Award daily quota to user based on community configuration
   * Uses meritRules.dailyQuota and quotaRecipients
   */
  async awardDailyQuota(userId: string, communityId: string): Promise<number> {
    const userRole = await this.permissionService.getUserRoleInCommunity(
      userId,
      communityId,
    );

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return 0;

    const rules = this.communityService.getEffectiveMeritSettings(community);

    // Check if role is in quotaRecipients
    if (!rules.quotaRecipients.includes(userRole as any)) {
      return 0;
    }

    return rules.dailyQuota;
  }

  /**
   * Convert merits from one community to another
   * Uses votingRules.meritConversion from source community configuration
   */
  async convertMerits(
    userId: string,
    sourceCommunityId: string,
    targetCommunityId: string,
    amount: number,
  ): Promise<number> {
    const sourceCommunity =
      await this.communityService.getCommunity(sourceCommunityId);
    if (!sourceCommunity) {
      throw new Error('Source community not found');
    }

    const rules = this.communityService.getEffectiveVotingSettings(sourceCommunity);
    if (!rules?.meritConversion) {
      throw new Error('Merit conversion not configured for this community');
    }

    // Check if conversion is to the correct target community
    if (rules.meritConversion.targetCommunityId !== targetCommunityId) {
      throw new Error('Invalid target community for conversion');
    }

    // Apply conversion ratio
    return Math.floor(amount * rules.meritConversion.ratio);
  }

  /**
   * Get merit stats for a user in a community
   * Only available for lead role
   */
  async getMeritStats(
    userId: string,
    communityId: string,
  ): Promise<number | null> {
    const userRole = await this.permissionService.getUserRoleInCommunity(
      userId,
      communityId,
    );

    // Leads (and global/community superadmins) can see merit stats
    if (userRole !== COMMUNITY_ROLE_LEAD && userRole !== COMMUNITY_ROLE_SUPERADMIN) {
      return null;
    }

    const user = await this.userService.getUserById(userId);
    if (!user) return null;

    return user.meritStats?.[communityId] || 0;
  }
}








