import { Logger } from '@nestjs/common';
import type { Community } from '../../../domain/models/community/community.schema';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import type { CommunityService } from '../../../domain/services/community.service';
import type { PlatformSettingsService } from '../../../domain/services/platform-settings.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import type { ProvisionBaseMembershipPort } from '../../../domain/ports/provision-base-membership.port';
import type { UserPersistencePort } from '../../../domain/ports/user.persistence.port';

const BASE_COMMUNITY_TYPE_TAGS = [
  'future-vision',
  'marathon-of-good',
  'team-projects',
  'support',
] as const;

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

export type ProvisionBaseMembershipDeps = {
  userPersistence: UserPersistencePort;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  walletService: WalletService;
  platformSettingsService: PlatformSettingsService;
};

/**
 * BC-01: ensure user membership in platform base hub communities.
 * Canonical implementation for ensureUserInBaseCommunities (13 call sites).
 */
export class ProvisionBaseMembershipUseCase implements ProvisionBaseMembershipPort {
  private readonly logger = new Logger(ProvisionBaseMembershipUseCase.name);

  constructor(private readonly deps: ProvisionBaseMembershipDeps) {}

  async execute(userId: string): Promise<void> {
    this.logger.log(`Ensuring user ${userId} is in base communities`);

    const baseCommunities = await Promise.all(
      BASE_COMMUNITY_TYPE_TAGS.map(async (typeTag) => ({
        typeTag,
        community: await this.deps.communityService.getCommunityByTypeTag(typeTag),
      })),
    );

    for (const { typeTag, community } of baseCommunities) {
      if (!community) {
        this.logger.warn(`${typeTag} community not found`);
      }
    }

    const user = await this.deps.userPersistence.findById(userId);
    if (!user) {
      this.logger.error(`User ${userId} not found`);
      return;
    }

    const memberships = user.communityMemberships || [];
    const pendingJoins = baseCommunities.filter(
      ({ community }) => community && !memberships.includes(community.id),
    );

    await this.deps.walletService.createOrGetWallet(
      userId,
      GLOBAL_COMMUNITY_ID,
      DEFAULT_CURRENCY,
    );

    if (pendingJoins.length > 0) {
      try {
        const welcomeMerits =
          await this.deps.platformSettingsService.getWelcomeMeritsGlobal();
        if (welcomeMerits > 0) {
          await this.deps.walletService.creditWelcomeMeritsIfNeeded(
            userId,
            welcomeMerits,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to credit welcome merits to user ${userId}: ${err instanceof Error ? err.message : 'Unknown'}`,
        );
      }
    }

    for (const { typeTag, community } of baseCommunities) {
      if (!community || memberships.includes(community.id)) {
        continue;
      }
      await this.addUserToBaseCommunity(userId, community, typeTag);
    }

    if (pendingJoins.length === 0) {
      this.logger.log(`User ${userId} already in base communities`);
    }
  }

  private async addUserToBaseCommunity(
    userId: string,
    community: Community,
    label: string,
  ): Promise<void> {
    this.logger.log(`Adding user ${userId} to ${label}`);
    try {
      const existingRole = await this.deps.userCommunityRoleService.getRole(
        userId,
        community.id,
      );

      await this.deps.communityService.addMember(community.id, userId);
      await this.deps.userPersistence.addCommunityMembership(userId, community.id);

      if (!existingRole) {
        await this.deps.userCommunityRoleService.setRole(
          userId,
          community.id,
          'participant',
          true,
        );
        this.logger.log(
          `Assigned participant role to user ${userId} in ${label} (no invite)`,
        );
      }

      const currency = community.settings?.currencyNames || DEFAULT_CURRENCY;
      await this.deps.walletService.createOrGetWallet(userId, community.id, currency, {
        startingMeritsIfNewWallet:
          this.deps.communityService.startingMeritsOnJoin(community),
      });

      this.logger.log(`User ${userId} successfully added to ${label}`);
    } catch (error) {
      this.logger.error(
        `Failed to add user ${userId} to ${label}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export function createProvisionBaseMembershipUseCase(
  deps: ProvisionBaseMembershipDeps,
): ProvisionBaseMembershipUseCase {
  return new ProvisionBaseMembershipUseCase(deps);
}
