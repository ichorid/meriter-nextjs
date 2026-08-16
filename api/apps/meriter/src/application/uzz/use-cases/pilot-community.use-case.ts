import { UzzForbiddenError, UzzNotFoundError, UzzValidationError } from '../../../domain/uzz/errors';
import { UzzPlatformCommunity, UzzPlatformPort } from '../ports/uzz-platform.port';
import { UzzAdminAccess } from './admin-resolve-deal.use-case';

export interface PilotCommunityOption {
  id: string;
  name: string;
}

export class ListPilotCommunitiesUseCase {
  constructor(
    private readonly platform: UzzPlatformPort,
    private readonly access: UzzAdminAccess,
  ) {}

  async execute(adminId: string): Promise<{
    selectedCommunityId: string;
    communities: PilotCommunityOption[];
  }> {
    const selectedCommunityId = await this.platform.configuredCommunityId();
    if (selectedCommunityId) {
      await this.access.assertCommunityAdmin(selectedCommunityId, adminId);
    }
    const communities = uniqueCommunities(await this.platform.listTelegramCommunities());
    if (selectedCommunityId && !communities.some((entry) => entry.id === selectedCommunityId)) {
      const current = await this.platform.getCommunity(selectedCommunityId);
      if (current) communities.unshift({ id: current.id, name: current.name });
    }
    return { selectedCommunityId, communities };
  }
}

export class SetPilotCommunityUseCase {
  constructor(
    private readonly platform: UzzPlatformPort,
    private readonly access: UzzAdminAccess,
  ) {}

  async execute(input: { adminId: string; communityId: string }) {
    const communityId = input.communityId.trim();
    if (!communityId) throw new UzzValidationError('COMMUNITY_ID_REQUIRED');
    const current = await this.platform.configuredCommunityId();
    if (current) {
      await this.access.assertCommunityAdmin(current, input.adminId);
    } else {
      await this.access.assertCommunityAdmin(communityId, input.adminId);
    }
    const community = await this.platform.getCommunity(communityId);
    if (!community) throw new UzzNotFoundError('COMMUNITY_NOT_FOUND');
    if (!community.telegramChatId) throw new UzzForbiddenError('PILOT_COMMUNITY_NOT_TELEGRAM');
    await this.platform.setSelectedCommunityId(community.id);
    return { communityId: community.id, communityName: community.name };
  }
}

function uniqueCommunities(communities: UzzPlatformCommunity[]): PilotCommunityOption[] {
  const seen = new Set<string>();
  const result: PilotCommunityOption[] = [];
  for (const community of communities) {
    if (!community.telegramChatId || seen.has(community.id)) continue;
    seen.add(community.id);
    result.push({ id: community.id, name: community.name });
  }
  return result;
}
