import { Injectable } from '@nestjs/common';
import { CommunityService } from '../../domain/services/community.service';

/**
 * Batch fetch pipeline for community display enrichment.
 */
@Injectable()
export class CommunityEnrichmentService {
  constructor(private readonly communityService: CommunityService) {}

  /**
   * Batch fetch communities by IDs and return as a Map for efficient lookup.
   * Uses listCommunitiesByIds instead of N× getCommunity.
   */
  async batchFetchCommunities(communityIds: string[]): Promise<Map<string, any>> {
    const communitiesMap = new Map<string, any>();

    if (communityIds.length === 0) {
      return communitiesMap;
    }

    const uniqueIds = [...new Set(communityIds.filter(Boolean))];
    const communities = await this.communityService.listCommunitiesByIds(uniqueIds);
    for (const community of communities) {
      if (community?.id) {
        communitiesMap.set(community.id, community);
      }
    }

    return communitiesMap;
  }

  /**
   * Format community for API response (origin format).
   */
  formatCommunityForApi(community: any | null):
    | {
        telegramChatName?: string;
      }
    | undefined {
    if (!community) {
      return undefined;
    }

    return {
      telegramChatName: community.name,
    };
  }
}
