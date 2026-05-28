import { Injectable } from '@nestjs/common';
import { PublicationService } from './publication.service';
import { PollService } from './poll.service';
import { UserService } from './user.service';
import { CommunityService } from './community.service';
import { FeedItem } from '../../../../../../libs/shared-types/dist/index';
import {
  createGetCommunityFeedUseCase,
  GetCommunityFeedUseCase,
  type FeedOptions,
} from '../../application/use-cases/feed/get-community-feed.use-case';

export type { FeedOptions };

@Injectable()
export class CommunityFeedService {
  private readonly getCommunityFeedUseCase: GetCommunityFeedUseCase;

  constructor(
    private readonly publicationService: PublicationService,
    private readonly pollService: PollService,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
  ) {
    this.getCommunityFeedUseCase = createGetCommunityFeedUseCase({
      publicationService: this.publicationService,
      pollService: this.pollService,
      userService: this.userService,
      communityService: this.communityService,
    });
  }

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

  async getCommunityFeed(
    communityId: string,
    options: FeedOptions = {},
  ): Promise<{
    data: FeedItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    return this.getCommunityFeedUseCase.execute(communityId, options);
  }
}
