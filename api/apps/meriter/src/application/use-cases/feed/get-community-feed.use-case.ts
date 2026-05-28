import type {
  FeedItem,
  PollFeedItem,
  PublicationFeedItem,
} from '@meriter/shared-types';
import { EntityMappers } from '../../../adapters/mappers/entity-mappers';
import type { Publication } from '../../../domain/aggregates/publication/publication.entity';
import type { Poll } from '../../../domain/aggregates/poll/poll.entity';
import type { FavoriteTargetType } from '../../../domain/models/favorite/favorite.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { FavoriteService } from '../../../domain/services/favorite.service';
import type { PollService } from '../../../domain/services/poll.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { UserService } from '../../../domain/services/user.service';
import {
  mapInvestmentsForPublicationFeed,
  type RawPublicationInvestment,
} from '../../../domain/services/feed-item-investments.mapper';

export interface FeedOptions {
  page?: number;
  pageSize?: number;
  skip?: number;
  limit?: number;
  sort?: 'recent' | 'score';
  tag?: string;
  search?: string;
  impactArea?: string;
  stage?: string;
  beneficiaries?: string[];
  methods?: string[];
  helpNeeded?: string[];
  categories?: string[];
  valueTags?: string[];
}

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

function toPublicationFeedItem(
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
  };
}

function toPollFeedItem(mapped: ReturnType<typeof EntityMappers.mapPollToApi>): PollFeedItem {
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

export function sortFeedItems(
  items: FeedItem[],
  sortBy: 'createdAt' | 'score',
): FeedItem[] {
  return [...items].sort((a, b) => {
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
  });
}

/**
 * Map domain publications and polls to unified feed DTOs via EntityMappers (P-2).
 */
export function mapPublicationsAndPollsToFeedItems(
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
    return toPublicationFeedItem(pub, mapped);
  });

  const pollFeedItems: PollFeedItem[] = polls.map((poll) => {
    const mapped = EntityMappers.mapPollToApi(
      poll,
      usersMap as Map<string, any>,
      communitiesMap as Map<string, any>,
    );
    return toPollFeedItem(mapped);
  });

  const allItems: FeedItem[] = [...publicationFeedItems, ...pollFeedItems];
  return sortBy ? sortFeedItems(allItems, sortBy) : allItems;
}

export async function buildDomainFeedMaps(
  publications: Publication[],
  polls: Poll[],
  userService: UserService,
  communityService: CommunityService,
): Promise<{
  usersMap: Map<string, unknown>;
  communitiesMap: Map<string, unknown>;
  logicalCommunitiesMap: Map<string, { id: string; name?: string; avatarUrl?: string }>;
}> {
  const userIds = new Set<string>();
  const communityIds = new Set<string>();
  const authoredCommunityIds = new Set<string>();

  for (const pub of publications) {
    const s = pub.toSnapshot();
    userIds.add(pub.getAuthorId.getValue());
    if (s.publishedByUserId) {
      userIds.add(s.publishedByUserId);
    }
    const beneficiaryId = pub.getBeneficiaryId?.getValue();
    if (beneficiaryId) {
      userIds.add(beneficiaryId);
    }
    communityIds.add(pub.getCommunityId.getValue());
    if (s.authorKind === 'community' && s.authoredCommunityId) {
      authoredCommunityIds.add(s.authoredCommunityId);
    }
  }

  for (const poll of polls) {
    const snapshot = poll.toSnapshot();
    userIds.add(snapshot.authorId);
    communityIds.add(snapshot.communityId);
  }

  const usersMap = new Map<string, unknown>();
  await Promise.all(
    Array.from(userIds).map(async (userId) => {
      const user = await userService.getUser(userId);
      if (user) {
        usersMap.set(userId, user);
      }
    }),
  );

  const communitiesMap = new Map<string, unknown>();
  await Promise.all(
    Array.from(communityIds).map(async (cid) => {
      const c = await communityService.getCommunity(cid);
      if (c) {
        communitiesMap.set(cid, c);
      }
    }),
  );

  const logicalCommunitiesMap = new Map<
    string,
    { id: string; name?: string; avatarUrl?: string }
  >();
  await Promise.all(
    Array.from(authoredCommunityIds).map(async (cid) => {
      const c = await communityService.getCommunity(cid);
      if (c) {
        logicalCommunitiesMap.set(cid, {
          id: cid,
          name: (c as { name?: string }).name,
          avatarUrl: (c as { avatarUrl?: string }).avatarUrl,
        });
      }
    }),
  );

  return { usersMap, communitiesMap, logicalCommunitiesMap };
}

export function buildFeedItemLookupMaps(
  publications: Publication[],
  polls: Poll[],
  usersMap: Map<string, unknown>,
  communitiesMap: Map<string, unknown>,
  logicalCommunitiesMap: Map<string, { id: string; name?: string; avatarUrl?: string }>,
): {
  publicationMap: Map<string, PublicationFeedItem>;
  pollMap: Map<string, PollFeedItem>;
} {
  const items = mapPublicationsAndPollsToFeedItems(
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

export type GetCommunityFeedDeps = {
  publicationService: PublicationService;
  pollService: PollService;
  userService: UserService;
  communityService: CommunityService;
};

/**
 * BC-01: community hub feed (publications + polls) with EntityMappers enrichment.
 */
export class GetCommunityFeedUseCase {
  constructor(private readonly deps: GetCommunityFeedDeps) {}

  async execute(
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
    const {
      page = 1,
      pageSize = 20,
      skip: providedSkip,
      limit: providedLimit,
      sort = 'score',
      tag,
      search,
      impactArea,
      stage,
      beneficiaries,
      methods,
      helpNeeded,
      categories,
      valueTags,
    } = options;

    const limit = providedLimit ?? pageSize;
    const skip = providedSkip ?? (page - 1) * pageSize;

    const community = await this.deps.communityService.getCommunity(communityId);
    const isFutureVision = community?.typeTag === 'future-vision';

    const hasCategoryFilters = !!(
      impactArea ||
      stage ||
      (beneficiaries && beneficiaries.length > 0) ||
      (methods && methods.length > 0) ||
      (helpNeeded && helpNeeded.length > 0) ||
      (categories && categories.length > 0) ||
      (valueTags && valueTags.length > 0)
    );

    const fetchLimit = limit * 2;
    const sortBy = sort === 'recent' ? 'createdAt' : 'score';

    const [publications, polls] = await Promise.all([
      this.deps.publicationService.getPublicationsByCommunity(
        communityId,
        fetchLimit,
        skip,
        sortBy,
        tag,
        {
          impactArea,
          stage,
          beneficiaries,
          methods,
          helpNeeded,
          categories,
          valueTags,
        },
        search,
        true,
      ),
      isFutureVision || hasCategoryFilters
        ? Promise.resolve([])
        : this.deps.pollService.getPollsByCommunity(
            communityId,
            fetchLimit,
            skip,
            sortBy,
            search,
          ),
    ]);

    const { usersMap, communitiesMap, logicalCommunitiesMap } =
      await buildDomainFeedMaps(
        publications,
        polls,
        this.deps.userService,
        this.deps.communityService,
      );

    const allFeedItems = mapPublicationsAndPollsToFeedItems(
      publications,
      polls,
      usersMap,
      communitiesMap,
      logicalCommunitiesMap,
      sortBy,
    );

    const feedItems = allFeedItems.slice(0, limit);
    const hasMore =
      allFeedItems.length > limit ||
      publications.length === fetchLimit ||
      polls.length === fetchLimit;

    return {
      data: feedItems,
      pagination: {
        page,
        pageSize: limit,
        total: allFeedItems.length,
        hasMore,
      },
    };
  }
}

export type ToggleFavoriteContext = {
  favoriteService: FavoriteService;
};

/** BC-10: add/remove favorite (idempotent upsert / delete). */
export class ToggleFavoriteUseCase {
  constructor(private readonly ctx: ToggleFavoriteContext) {}

  async add(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    await this.ctx.favoriteService.addFavorite(userId, targetType, targetId);
  }

  async remove(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    await this.ctx.favoriteService.removeFavorite(userId, targetType, targetId);
  }
}

export type MarkNotificationsReadContext = {
  favoriteService: FavoriteService;
};

/** BC-10: mark favorite target as viewed (clears unread highlight). */
export class MarkNotificationsReadUseCase {
  constructor(private readonly ctx: MarkNotificationsReadContext) {}

  async execute(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<void> {
    await this.ctx.favoriteService.markAsViewed(userId, targetType, targetId);
  }
}

export function createGetCommunityFeedUseCase(
  deps: GetCommunityFeedDeps,
): GetCommunityFeedUseCase {
  return new GetCommunityFeedUseCase(deps);
}

export function createToggleFavoriteUseCase(
  ctx: ToggleFavoriteContext,
): ToggleFavoriteUseCase {
  return new ToggleFavoriteUseCase(ctx);
}

export function createMarkNotificationsReadUseCase(
  ctx: MarkNotificationsReadContext,
): MarkNotificationsReadUseCase {
  return new MarkNotificationsReadUseCase(ctx);
}
