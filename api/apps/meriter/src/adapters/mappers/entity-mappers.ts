import type {
  FeedItem,
  PollFeedItem,
  PublicationFeedItem,
} from '@meriter/shared-types';
import { Publication } from '../../domain/aggregates/publication/publication.entity';
import type { Poll } from '../../domain/aggregates/poll/poll.entity';
import { UserFormatter } from '../../api-v1/common/utils/user-formatter.util';
import { VoteTransactionCalculatorService } from '../../api-v1/common/services/vote-transaction-calculator.service';
import {
  mapInvestmentsForPublicationFeed,
  type RawPublicationInvestment,
} from '../../domain/services/feed-item-investments.mapper';

type ApiMetaParty = {
  id?: string;
  name: string;
  username?: string;
  photoUrl?: string;
};

type ApiMappedMeta = {
  author: ApiMetaParty;
  publishedBy?: ApiMetaParty;
  beneficiary?: ApiMetaParty;
  origin?: { telegramChatName?: string };
};

function feedMetaFromApiMeta(meta: ApiMappedMeta): PublicationFeedItem['meta'] {
  return {
    author: {
      name: meta.author.name,
      username: meta.author.username,
      photoUrl: meta.author.photoUrl,
    },
    ...(meta.publishedBy && { publishedBy: meta.publishedBy }),
    ...(meta.beneficiary && {
      beneficiary: {
        name: meta.beneficiary.name,
        username: meta.beneficiary.username,
        photoUrl: meta.beneficiary.photoUrl,
      },
    }),
    ...(meta.origin && { origin: meta.origin }),
  };
}

/**
 * Utility class for mapping domain entities to API response formats
 */
export class EntityMappers {
  /**
   * Format community for API response (origin format)
   */
  private static formatCommunityForApi(community: any | null):
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

  /**
   * Map Publication entity to API format
   */
  static mapPublicationToApi(
    publication: Publication,
    usersMap: Map<string, any>,
    communitiesMap: Map<string, any>,
    opts?: { logicalAuthorCommunity?: { id: string; name?: string; avatarUrl?: string } | null },
  ): any {
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue();
    const communityId = publication.getCommunityId.getValue();
    const snapshot = publication.toSnapshot();
    const logicalComm = opts?.logicalAuthorCommunity;
    const authorFromCommunity =
      snapshot.authorKind === 'community' && logicalComm
        ? {
            id: logicalComm.id,
            name: logicalComm.name ?? 'Community',
            username: undefined,
            photoUrl: logicalComm.avatarUrl,
          }
        : null;
    const authorUser = usersMap.get(authorId);
    const author = authorFromCommunity ?? authorUser;
    const publisherUserId =
      snapshot.authorKind === 'community'
        ? (snapshot.publishedByUserId ?? authorId)
        : undefined;
    const publisherUser =
      snapshot.authorKind === 'community' && authorFromCommunity
        ? usersMap.get(publisherUserId ?? authorId)
        : null;
    const beneficiary = beneficiaryId ? usersMap.get(beneficiaryId) : null;
    const community = communitiesMap.get(communityId);
    const images = publication.getImages;

    return {
      id: publication.getId.getValue(),
      _id: publication.getId.getValue(), // For compatibility with Publication component
      slug: publication.getId.getValue(), // Use id as slug for navigation
      communityId,
      authorId,
      beneficiaryId: beneficiaryId || undefined,
      content: publication.getContent,
      type: publication.getType,
      hashtags: publication.getHashtags,
      categories: snapshot.categories || [],
      valueTags: snapshot.valueTags ?? [],
      images: images && images.length > 0 ? images : undefined,
      videoUrl: snapshot.videoUrl || undefined,
      title: publication.getTitle || undefined,
      description: publication.getDescription || undefined,
      postType: snapshot.postType || 'basic',
      isProject: snapshot.isProject || false,
      // Forwarding / review flow
      forwardStatus: snapshot.forwardStatus ?? null,
      forwardTargetCommunityId: snapshot.forwardTargetCommunityId || undefined,
      forwardProposedBy: snapshot.forwardProposedBy || undefined,
      forwardProposedAt: snapshot.forwardProposedAt || undefined,
      telegramModerationStatus: snapshot.telegramModerationStatus ?? null,
      // Project taxonomy (needed for edit prefill + cards outside community feed)
      impactArea: snapshot.impactArea || undefined,
      stage: snapshot.stage || undefined,
      beneficiaries:
        snapshot.beneficiaries && snapshot.beneficiaries.length > 0
          ? snapshot.beneficiaries
          : undefined,
      methods:
        snapshot.methods && snapshot.methods.length > 0
          ? snapshot.methods
          : undefined,
      helpNeeded:
        snapshot.helpNeeded && snapshot.helpNeeded.length > 0
          ? snapshot.helpNeeded
          : undefined,
      metrics: {
        upvotes: publication.getMetrics.upvotes,
        downvotes: publication.getMetrics.downvotes,
        score: publication.getMetrics.score,
        commentCount: publication.getMetrics.commentCount,
        viewCount: 0, // Not available in current entity
      },
      sourceEntityId: snapshot.sourceEntityId,
      sourceEntityType: snapshot.sourceEntityType,
      authorKind: snapshot.authorKind,
      authoredCommunityId: snapshot.authoredCommunityId,
      publishedByUserId: snapshot.publishedByUserId,
      meta: {
        author: UserFormatter.formatUserForApi(
          author,
          authorFromCommunity ? authorFromCommunity.id : authorId,
        ),
        ...(authorFromCommunity &&
          publisherUserId && {
            publishedBy: UserFormatter.formatUserForApi(
              publisherUser,
              publisherUserId,
            ),
          }),
        ...(beneficiary && beneficiaryId && {
          beneficiary: UserFormatter.formatUserForApi(
            beneficiary,
            beneficiaryId,
          ),
        }),
        ...(community && {
          origin: this.formatCommunityForApi(community),
        }),
      },
      deleted: snapshot.deleted ?? false,
      deletedAt: snapshot.deletedAt ? snapshot.deletedAt.toISOString() : undefined,
      isPinned: snapshot.isPinned ?? false,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  /**
   * Map Poll entity to API format
   */
  static mapPollToApi(
    poll: any, // Poll entity (using any since we don't have the exact type)
    usersMap: Map<string, any>,
    communitiesMap: Map<string, any>,
  ): any {
    const snapshot = poll.toSnapshot();
    const authorId = snapshot.authorId;
    const communityId = snapshot.communityId;
    const author = usersMap.get(authorId);
    const community = communitiesMap.get(communityId);

    return {
      id: snapshot.id,
      authorId,
      communityId,
      question: snapshot.question,
      description: snapshot.description,
      options: snapshot.options.map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes,
        amount: opt.amount || 0,
        casterCount: opt.casterCount,
      })),
      metrics: snapshot.metrics,
      expiresAt: snapshot.expiresAt.toISOString(),
      isActive: snapshot.isActive,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
      // Add metadata for frontend compatibility with PublicationCard
      meta: {
        author: UserFormatter.formatUserForApi(author, authorId),
        ...(community && {
          origin: this.formatCommunityForApi(community),
        }),
      },
      // Add type field to indicate this is a poll (for PublicationCard compatibility)
      type: 'poll' as const,
      // Add content field using question for PublicationCard compatibility
      content: snapshot.question,
    };
  }

  /**
   * Map Comment entity to API format
   */
  static mapCommentToApi(
    comment: any, // Comment entity or vote (using any for flexibility)
    usersMap: Map<string, any>,
    publicationSlug?: string,
    communityId?: string,
  ): any {
    // Handle both Comment entities and Vote objects (votes contain comments)
    const authorId =
      comment.userId || comment.authorId || comment.getAuthorId?.getValue?.();
    const author = usersMap.get(authorId);

    // Get images from entity or schema - check multiple sources
    const images = comment.images ||
      comment.getImages?.() ||
      (comment.snapshot?.images) ||
      (comment.toSnapshot?.()?.images) ||
      [];

    const baseComment = {
      id: comment.id || comment.getId?.getValue(),
      _id: comment.id || comment.getId?.getValue(),
      targetType: comment.targetType || comment.getTargetType,
      targetId: comment.targetId || comment.getTargetId,
      authorId,
      content:
        comment.comment ||
        comment.content ||
        (typeof comment.getContent === 'function' ? comment.getContent() : undefined),
      ...(comment.isAutoComment === true ? { isAutoComment: true } : {}),
      ...(images && Array.isArray(images) && images.length > 0 && { images }),
      createdAt:
        comment.createdAt?.toISOString?.() ||
        new Date(comment.createdAt).toISOString(),
      updatedAt:
        comment.updatedAt?.toISOString?.() ||
        comment.createdAt?.toISOString?.() ||
        new Date(comment.createdAt).toISOString(),
      ...(publicationSlug && { publicationSlug }),
      ...(communityId && { communityId }),
      meta: {
        author: UserFormatter.formatUserForApi(author, authorId),
      },
    };

    // Add vote transaction fields if this is a vote
    if (
      comment.amountQuota !== undefined ||
      comment.amountWallet !== undefined
    ) {
      const tx = VoteTransactionCalculatorService.calculate(comment);
      if (tx) {
        return { ...baseComment, ...tx };
      }
    }

    return baseComment;
  }

  private static toPublicationFeedItem(
    publication: Publication,
    mapped: ReturnType<typeof EntityMappers.mapPublicationToApi>,
  ): PublicationFeedItem {
    const snapshot = publication.toSnapshot();
    return {
      id: mapped.id,
      type: 'publication',
      communityId: mapped.communityId,
      authorId: mapped.authorId,
      beneficiaryId: mapped.beneficiaryId,
      content: mapped.content,
      slug: mapped.slug,
      title: mapped.title,
      description: mapped.description,
      postType: mapped.postType,
      isProject: mapped.isProject,
      hashtags: mapped.hashtags ?? [],
      categories: mapped.categories ?? [],
      valueTags: mapped.valueTags ?? [],
      imageUrl: snapshot.imageUrl || undefined,
      images: mapped.images,
      impactArea: mapped.impactArea,
      stage: mapped.stage,
      beneficiaries: mapped.beneficiaries,
      methods: mapped.methods,
      helpNeeded: mapped.helpNeeded,
      metrics: {
        upvotes: mapped.metrics.upvotes,
        downvotes: mapped.metrics.downvotes,
        score: mapped.metrics.score,
        commentCount: mapped.metrics.commentCount,
      },
      meta: feedMetaFromApiMeta(mapped.meta as ApiMappedMeta),
      ...(mapped.authorKind === 'community' &&
        mapped.authoredCommunityId && {
          authorKind: 'community' as const,
          authoredCommunityId: mapped.authoredCommunityId,
          publishedByUserId: mapped.publishedByUserId,
        }),
      deleted: mapped.deleted ?? false,
      deletedAt: mapped.deletedAt,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt,
      investingEnabled: snapshot.investingEnabled ?? false,
      investorSharePercent: snapshot.investorSharePercent,
      investmentPool: snapshot.investmentPool ?? 0,
      investmentPoolTotal: snapshot.investmentPoolTotal ?? 0,
      investments: mapInvestmentsForPublicationFeed(
        snapshot.investments as readonly RawPublicationInvestment[] | undefined,
      ),
      stopLoss: snapshot.stopLoss ?? 0,
      noAuthorWalletSpend: snapshot.noAuthorWalletSpend ?? false,
      sourceEntityId: snapshot.sourceEntityId,
      sourceEntityType: snapshot.sourceEntityType,
      isPinned: snapshot.isPinned ?? false,
    };
  }

  private static toPollFeedItem(
    mapped: ReturnType<typeof EntityMappers.mapPollToApi>,
  ): PollFeedItem {
    return {
      id: mapped.id,
      type: 'poll',
      communityId: mapped.communityId,
      authorId: mapped.authorId,
      question: mapped.question,
      description: mapped.description,
      slug: mapped.id,
      options: mapped.options,
      expiresAt: mapped.expiresAt,
      isActive: mapped.isActive,
      metrics: {
        totalCasts: mapped.metrics.totalCasts,
        casterCount: mapped.metrics.casterCount,
        totalAmount: mapped.metrics.totalAmount,
      },
      meta: feedMetaFromApiMeta(mapped.meta as ApiMappedMeta),
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt,
    };
  }

  static sortFeedItems(
    items: FeedItem[],
    sortBy: 'createdAt' | 'score',
  ): FeedItem[] {
    const compare = (a: FeedItem, b: FeedItem): number => {
      if (sortBy === 'score') {
        const scoreA =
          a.type === 'publication' ? a.metrics.score : a.metrics.totalAmount || 0;
        const scoreB =
          b.type === 'publication' ? b.metrics.score : b.metrics.totalAmount || 0;
        return scoreB - scoreA;
      }
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    };

    const pinned = items.filter(
      (item) => item.type === 'publication' && item.isPinned === true,
    );
    const rest = items.filter(
      (item) => !(item.type === 'publication' && item.isPinned === true),
    );

    return [...pinned.sort(compare), ...rest.sort(compare)];
  }

  /**
   * Map domain publications and polls to unified feed DTOs (P-2 canonical path).
   */
  static mapPublicationsAndPollsToFeedItems(
    publications: Publication[],
    polls: Poll[],
    usersMap: Map<string, unknown>,
    communitiesMap: Map<string, unknown>,
    logicalCommunitiesMap: Map<string, { id: string; name?: string; avatarUrl?: string }>,
    sortBy?: 'createdAt' | 'score',
  ): FeedItem[] {
    const publicationFeedItems: PublicationFeedItem[] = publications.map((pub) => {
      const snapshot = pub.toSnapshot();
      const logicalComm =
        snapshot.authorKind === 'community' && snapshot.authoredCommunityId
          ? logicalCommunitiesMap.get(snapshot.authoredCommunityId)
          : undefined;
      const mapped = EntityMappers.mapPublicationToApi(
        pub,
        usersMap as Map<string, any>,
        communitiesMap as Map<string, any>,
        {
          logicalAuthorCommunity: logicalComm
            ? {
                id: snapshot.authoredCommunityId!,
                name: logicalComm.name,
                avatarUrl: logicalComm.avatarUrl,
              }
            : null,
        },
      );
      return EntityMappers.toPublicationFeedItem(pub, mapped);
    });

    const pollFeedItems: PollFeedItem[] = polls.map((poll) => {
      const mapped = EntityMappers.mapPollToApi(
        poll,
        usersMap as Map<string, any>,
        communitiesMap as Map<string, any>,
      );
      return EntityMappers.toPollFeedItem(mapped);
    });

    const allItems: FeedItem[] = [...publicationFeedItems, ...pollFeedItems];
    return sortBy ? EntityMappers.sortFeedItems(allItems, sortBy) : allItems;
  }

  static buildFeedItemLookupMaps(
    publications: Publication[],
    polls: Poll[],
    usersMap: Map<string, unknown>,
    communitiesMap: Map<string, unknown>,
    logicalCommunitiesMap: Map<string, { id: string; name?: string; avatarUrl?: string }>,
  ): {
    publicationMap: Map<string, PublicationFeedItem>;
    pollMap: Map<string, PollFeedItem>;
  } {
    const items = EntityMappers.mapPublicationsAndPollsToFeedItems(
      publications,
      polls,
      usersMap,
      communitiesMap,
      logicalCommunitiesMap,
    );
    const publicationMap = new Map<string, PublicationFeedItem>();
    const pollMap = new Map<string, PollFeedItem>();
    for (const item of items) {
      if (item.type === 'publication') {
        publicationMap.set(item.id, item);
      } else {
        pollMap.set(item.id, item);
      }
    }
    return { publicationMap, pollMap };
  }
}
