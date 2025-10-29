import { Injectable, Logger } from '@nestjs/common';
import { PublicationService } from './publication.service';
import { PollService } from './poll.service';
import { UserService } from './user.service';
import { Publication } from '../aggregates/publication/publication.entity';
import { Poll } from '../aggregates/poll/poll.entity';
import { FeedItem, PublicationFeedItem, PollFeedItem } from '../../../../../../libs/shared-types/dist/index';

export interface FeedOptions {
  page?: number;
  pageSize?: number;
  skip?: number;
  limit?: number;
  sort?: 'recent' | 'score';
  tag?: string;
}

@Injectable()
export class CommunityFeedService {
  private readonly logger = new Logger(CommunityFeedService.name);

  constructor(
    private readonly publicationService: PublicationService,
    private readonly pollService: PollService,
    private readonly userService: UserService,
  ) {}

  async getCommunityFeed(communityId: string, options: FeedOptions = {}): Promise<{
    data: FeedItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const {
      page = 1,
      pageSize = 20,
      skip: providedSkip,
      limit: providedLimit,
      sort = 'score',
      tag,
    } = options;

    // Use skip/limit if provided, otherwise calculate from page/pageSize
    const limit = providedLimit ?? pageSize;
    const skip = providedSkip ?? (page - 1) * pageSize;

    // Fetch both publications and polls in parallel
    // Fetch more items than needed to ensure we have enough after merging and sorting
    const fetchLimit = limit * 2; // Fetch 2x limit from each source
    const sortBy = sort === 'recent' ? 'createdAt' : 'score';
    
    const [publications, polls] = await Promise.all([
      this.publicationService.getPublicationsByCommunity(
        communityId,
        fetchLimit,
        skip,
        sortBy,
        tag
      ),
      this.pollService.getPollsByCommunity(
        communityId,
        fetchLimit,
        skip,
        sortBy
      ),
    ]);

    // Transform to unified feed items
    const allFeedItems = await this.mergeAndTransform(publications, polls, sortBy);
    
    // Limit to requested page size after merging and sorting
    const feedItems = allFeedItems.slice(0, limit);

    // Calculate pagination
    // We have more if we fetched fetchLimit items and got limit back, or if either source has more
    const hasMore = allFeedItems.length > limit || publications.length === fetchLimit || polls.length === fetchLimit;
    const total = allFeedItems.length; // Total items available after merge

    return {
      data: feedItems,
      pagination: {
        page,
        pageSize: limit,
        total,
        hasMore,
      },
    };
  }

  private async mergeAndTransform(
    publications: Publication[],
    polls: Poll[],
    sortBy: 'createdAt' | 'score'
  ): Promise<FeedItem[]> {
    // Extract all user IDs to batch fetch
    const userIds = new Set<string>();
    
    publications.forEach(pub => {
      userIds.add(pub.getAuthorId.getValue());
      const beneficiaryId = pub.getBeneficiaryId?.getValue();
      if (beneficiaryId) {
        userIds.add(beneficiaryId);
      }
    });

    polls.forEach(poll => {
      userIds.add(poll.getAuthorId);
    });

    // Batch fetch all users (avoid N+1)
    const usersMap = new Map<string, any>();
    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const user = await this.userService.getUser(userId);
        if (user) {
          usersMap.set(userId, user);
        }
      })
    );

    // Transform publications to feed items
    const publicationFeedItems: PublicationFeedItem[] = publications.map(pub => {
      const authorId = pub.getAuthorId.getValue();
      const beneficiaryId = pub.getBeneficiaryId?.getValue();
      const author = usersMap.get(authorId);
      const beneficiary = beneficiaryId ? usersMap.get(beneficiaryId) : null;
      const snapshot = pub.toSnapshot();

      return {
        id: snapshot.id,
        type: 'publication' as const,
        communityId: snapshot.communityId,
        authorId,
        beneficiaryId: beneficiaryId || undefined,
        content: snapshot.content,
        slug: snapshot.id, // Use id as slug fallback
        hashtags: snapshot.hashtags || [],
        metrics: {
          upvotes: snapshot.metrics.upvotes,
          downvotes: snapshot.metrics.downvotes,
          score: snapshot.metrics.score,
          commentCount: snapshot.metrics.commentCount,
        },
        meta: {
          author: {
            name: author?.displayName || author?.firstName || 'Unknown',
            username: author?.username,
            photoUrl: author?.avatarUrl,
          },
          ...(beneficiary && {
            beneficiary: {
              name: beneficiary.displayName || beneficiary.firstName || 'Unknown',
              username: beneficiary.username,
              photoUrl: beneficiary.avatarUrl,
            },
          }),
        },
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
      };
    });

    // Transform polls to feed items
    const pollFeedItems: PollFeedItem[] = polls.map(poll => {
      const authorId = poll.getAuthorId;
      const author = usersMap.get(authorId);
      const snapshot = poll.toSnapshot();

      return {
        id: snapshot.id,
        type: 'poll' as const,
        communityId: snapshot.communityId,
        authorId,
        question: snapshot.question,
        description: snapshot.description,
        slug: snapshot.id, // Use id as slug fallback
        options: snapshot.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          votes: opt.votes,
          amount: opt.amount,
          voterCount: opt.voterCount,
        })),
        expiresAt: snapshot.expiresAt.toISOString(),
        isActive: snapshot.isActive,
        metrics: {
          totalVotes: snapshot.metrics.totalVotes,
          voterCount: snapshot.metrics.voterCount,
          totalAmount: snapshot.metrics.totalAmount,
        },
        meta: {
          author: {
            name: author?.displayName || author?.firstName || 'Unknown',
            username: author?.username,
            photoUrl: author?.avatarUrl,
          },
        },
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
      };
    });

    // Merge and sort
    const allItems: FeedItem[] = [...publicationFeedItems, ...pollFeedItems];
    
    return this.sortFeedItems(allItems, sortBy);
  }

  private sortFeedItems(items: FeedItem[], sortBy: 'createdAt' | 'score'): FeedItem[] {
    return [...items].sort((a, b) => {
      if (sortBy === 'score') {
        const scoreA = a.type === 'publication' 
          ? a.metrics.score 
          : (a.metrics.totalAmount || 0);
        const scoreB = b.type === 'publication' 
          ? b.metrics.score 
          : (b.metrics.totalAmount || 0);
        return scoreB - scoreA; // Descending
      } else {
        // Sort by createdAt (recent first)
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Descending (most recent first)
      }
    });
  }
}

