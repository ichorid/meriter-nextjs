import { TRPCError } from '@trpc/server';
import type { UpdateCommunityDto } from '@meriter/shared-types';
import type { Community } from '../../../domain/models/community/community.schema';
import { CommunitySetupHelpers } from '../../../api-v1/common/helpers/community-setup.helpers';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import type { CommunityService } from '../../../domain/services/community.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';

export type UpdateCommunitySettingsInput = {
  communityId: string;
  data: UpdateCommunityDto;
  actorUserId: string;
  actorGlobalRole?: string | null;
};

export type UpdateCommunitySettingsDeps = {
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
};

function formatUpdatedCommunityResponse(
  community: Community,
  deps: UpdateCommunitySettingsDeps,
  adminIds: string[],
  isAdmin: boolean,
) {
  const communityDoc = community as Community & Record<string, unknown>;

  return {
    ...community,
    permissionRules: deps.communityService.getEffectivePermissionRules(community),
    meritSettings: deps.communityService.getEffectiveMeritSettings(community),
    votingSettings: deps.communityService.getEffectiveVotingSettings(community),
    postingRules: communityDoc.postingRules,
    votingRules: communityDoc.votingRules,
    visibilityRules: communityDoc.visibilityRules,
    meritRules: communityDoc.meritRules,
    settings: {
      currencyNames: community.settings?.currencyNames,
      dailyEmission: community.settings?.dailyEmission as number,
      iconUrl: community.settings?.iconUrl,
      language: community.settings?.language ?? 'en',
      postCost: community.settings?.postCost ?? 1,
      pollCost: community.settings?.pollCost ?? 1,
      editWindowMinutes: community.settings?.editWindowMinutes ?? 30,
      allowEditByOthers: community.settings?.allowEditByOthers ?? false,
      canPayPostFromQuota: community.settings?.canPayPostFromQuota ?? false,
      investingEnabled: community.settings?.investingEnabled ?? false,
      investorShareMin: community.settings?.investorShareMin ?? 1,
      investorShareMax: community.settings?.investorShareMax ?? 99,
      requireTTLForInvestPosts: community.settings?.requireTTLForInvestPosts ?? false,
      maxTTL: community.settings?.maxTTL ?? null,
      inactiveCloseDays: community.settings?.inactiveCloseDays ?? 7,
      distributeAllByContractOnClose:
        community.settings?.distributeAllByContractOnClose ?? true,
      tappalkaOnlyMode: community.settings?.tappalkaOnlyMode ?? false,
      commentMode:
        community.settings?.commentMode ??
        (community.settings?.tappalkaOnlyMode ? 'neutralOnly' : 'all'),
    },
    hashtagDescriptions:
      community.hashtagDescriptions instanceof Map
        ? Object.fromEntries(community.hashtagDescriptions)
        : community.hashtagDescriptions || {},
    adminIds,
    isAdmin,
    needsSetup: CommunitySetupHelpers.calculateNeedsSetup(community, false),
    createdAt: community.createdAt.toISOString(),
    updatedAt: community.updatedAt.toISOString(),
  };
}

/**
 * BC-01: update community settings (admin or superadmin).
 * inv-08: authorization and field-level gates before persistence.
 */
export class UpdateCommunitySettingsUseCase {
  constructor(private readonly deps: UpdateCommunitySettingsDeps) {}

  async execute(input: UpdateCommunitySettingsInput) {
    const isAdmin = await this.deps.communityService.isUserAdmin(
      input.communityId,
      input.actorUserId,
    );
    const isSuperadmin = input.actorGlobalRole === GLOBAL_ROLE_SUPERADMIN;

    if (!isAdmin && !isSuperadmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only administrators can update community settings',
      });
    }

    if (input.data.isPriority !== undefined && !isSuperadmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only superadmin can set community priority',
      });
    }

    const invSettings = input.data.settings;
    if (
      invSettings &&
      (invSettings.investorShareMin !== undefined ||
        invSettings.investorShareMax !== undefined)
    ) {
      const min = invSettings.investorShareMin ?? 1;
      const max = invSettings.investorShareMax ?? 99;
      if (min < 1 || min > 99) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'investorShareMin must be between 1 and 99',
        });
      }
      if (max < 1 || max > 99) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'investorShareMax must be between 1 and 99',
        });
      }
      if (min > max) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'investorShareMin must be less than or equal to investorShareMax',
        });
      }
    }

    const community = await this.deps.communityService.updateCommunity(
      input.communityId,
      input.data,
    );

    const adminRoles = await this.deps.userCommunityRoleService.getUsersByRole(
      input.communityId,
      'lead',
    );
    const adminIds = adminRoles.map((role) => role.userId);
    const actorIsAdmin = await this.deps.communityService.isUserAdmin(
      input.communityId,
      input.actorUserId,
    );

    return formatUpdatedCommunityResponse(
      community,
      this.deps,
      adminIds,
      actorIsAdmin,
    );
  }
}

export function createUpdateCommunitySettingsUseCase(
  deps: UpdateCommunitySettingsDeps,
): UpdateCommunitySettingsUseCase {
  return new UpdateCommunitySettingsUseCase(deps);
}
