import { Injectable } from '@nestjs/common';
import { CommunityService } from '../../../domain/services/community.service';

/**
 * Service for batch fetching and enriching communities
 */
@Injectable()
export class CommunityEnrichmentService {
  constructor(private readonly communityService: CommunityService) {}

  /**
   * Batch fetch communities by IDs and return as a Map for efficient lookup
   * @param communityIds Array of community IDs to fetch
   * @returns Map of communityId -> community object
   */
  async batchFetchCommunities(communityIds: string[]): Promise<Map<string, any>> {
    const communitiesMap = new Map<string, any>();
    
    if (communityIds.length === 0) {
      return communitiesMap;
    }

    await Promise.all(
      communityIds.map(async (communityId) => {
        try {
          const community = await this.communityService.getCommunity(communityId);
          if (community) {
            communitiesMap.set(communityId, community);
          }
        } catch (_error) {
          // Silently skip communities that don't exist
        }
      })
    );

    return communitiesMap;
  }

  /**
   * Format community for API response (origin format)
   * @param community Community object
   * @returns Formatted community object for API response
   */
  formatCommunityForApi(community: any | null): {
    telegramChatName?: string;
  } | undefined {
    if (!community) {
      return undefined;
    }
    
    return {
      telegramChatName: community.name,
    };
  }
}

