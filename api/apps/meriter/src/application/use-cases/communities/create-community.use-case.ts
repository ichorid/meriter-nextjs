import type { CreateCommunityDto } from '@meriter/shared-types';
import type { Community } from '../../../domain/models/community/community.schema';
import { calculateCommunityNeedsSetup } from '../../../domain/common/helpers/community-setup.helper';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import type { CommunityService } from '../../../domain/services/community.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';

export type CreateCommunityInput = CreateCommunityDto & {
  creatorUserId: string;
  creatorGlobalRole?: string | null;
};

export type CreateCommunityDeps = {
  communityService: CommunityService;
  userService: UserService;
  userCommunityRoleService: UserCommunityRoleService;
  walletService: WalletService;
};

function formatCreatedCommunityResponse(
  community: Community,
  deps: CreateCommunityDeps,
  adminIds: string[],
) {
  return {
    ...community,
    permissionRules: deps.communityService.getEffectivePermissionRules(community),
    meritSettings: deps.communityService.getEffectiveMeritSettings(community),
    votingSettings: deps.communityService.getEffectiveVotingSettings(community),
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
    },
    hashtagDescriptions:
      community.hashtagDescriptions instanceof Map
        ? Object.fromEntries(community.hashtagDescriptions)
        : community.hashtagDescriptions || {},
    adminIds,
    isAdmin: true,
    needsSetup: calculateCommunityNeedsSetup(community, false),
    createdAt: community.createdAt.toISOString(),
    updatedAt: community.updatedAt.toISOString(),
  };
}

/**
 * BC-01: create a community and provision creator as lead member.
 * inv-08: isPriority mutation restricted to superadmin before persistence.
 */
export class CreateCommunityUseCase {
  constructor(private readonly deps: CreateCommunityDeps) {}

  async execute(input: CreateCommunityInput) {
    const isSuperadmin = input.creatorGlobalRole === GLOBAL_ROLE_SUPERADMIN;

    const communityDto: CreateCommunityDto & { creatorUserId: string } = {
      name: input.name,
      description: input.description,
      avatarUrl: input.avatarUrl,
      settings: input.settings,
      hashtags: input.hashtags,
      hashtagDescriptions: input.hashtagDescriptions,
      postingRules: input.postingRules,
      votingRules: input.votingRules,
      visibilityRules: input.visibilityRules,
      meritRules: input.meritRules,
      linkedCurrencies: input.linkedCurrencies,
      typeTag: input.typeTag,
      futureVisionText: input.futureVisionText,
      futureVisionDocumentSeed: input.futureVisionDocumentSeed,
      futureVisionTags: input.futureVisionTags,
      futureVisionCover: input.futureVisionCover,
      creatorUserId: input.creatorUserId,
    };

    if (isSuperadmin && typeof input.isPriority === 'boolean') {
      communityDto.isPriority = input.isPriority;
    }

    const community = await this.deps.communityService.createCommunity(communityDto);

    await this.deps.communityService.addMember(community.id, input.creatorUserId);
    await this.deps.userService.addCommunityMembership(
      input.creatorUserId,
      community.id,
    );
    await this.deps.userCommunityRoleService.setRole(
      input.creatorUserId,
      community.id,
      'lead',
    );

    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    await this.deps.walletService.createOrGetWallet(
      input.creatorUserId,
      community.id,
      currency,
      {
        startingMeritsIfNewWallet:
          this.deps.communityService.startingMeritsOnJoin(community),
      },
    );

    const adminRoles = await this.deps.userCommunityRoleService.getUsersByRole(
      community.id,
      'lead',
    );
    const adminIds = adminRoles.map((role) => role.userId);

    return formatCreatedCommunityResponse(community, this.deps, adminIds);
  }
}

export function createCreateCommunityUseCase(
  deps: CreateCommunityDeps,
): CreateCommunityUseCase {
  return new CreateCommunityUseCase(deps);
}
