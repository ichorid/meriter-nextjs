import { Injectable } from '@nestjs/common';
import { PublicationService } from './publication.service';
import { PollService } from './poll.service';
import { CommunityService } from './community.service';

/**
 * Community hub feed counters. The full feed read (`getCommunityFeed`) lives in
 * `GetCommunityFeedUseCase` and is invoked directly by the communities router; only the
 * hub post counter remains here (no application import, Zone 8 clean).
 */
@Injectable()
export class CommunityFeedService {
  constructor(
    private readonly publicationService: PublicationService,
    private readonly pollService: PollService,
    private readonly communityService: CommunityService,
  ) {}

  /** Matches hub «Посты» tab (publications + polls, excluding project/event rows). */
  async countHubFeedPosts(communityId: string): Promise<number> {
    const community = await this.communityService.getCommunity(communityId);
    const isFutureVision = community?.typeTag === 'future-vision';

    const [publicationCount, pollCount] = await Promise.all([
      this.publicationService.countHubFeedPublicationsByCommunity(communityId),
      isFutureVision
        ? Promise.resolve(0)
        : this.pollService.countActivePollsByCommunity(communityId),
    ]);

    return publicationCount + pollCount;
  }
}
