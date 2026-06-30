import type { FeedItem } from '@meriter/shared-types';
import { EntityMappers } from '../../../adapters/mappers/entity-mappers';
import type { Publication } from '../../../domain/aggregates/publication/publication.entity';
import type { Poll } from '../../../domain/aggregates/poll/poll.entity';
import type { FavoriteTargetType } from '../../../domain/models/favorite/favorite.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { FavoriteService } from '../../../domain/services/favorite.service';
import type { PollService } from '../../../domain/services/poll.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { UserService } from '../../../domain/services/user.service';

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

/** @deprecated Use EntityMappers.sortFeedItems */
export const sortFeedItems = EntityMappers.sortFeedItems.bind(EntityMappers);

/** @deprecated Use EntityMappers.mapPublicationsAndPollsToFeedItems */
export const mapPublicationsAndPollsToFeedItems =
  EntityMappers.mapPublicationsAndPollsToFeedItems.bind(EntityMappers);

/** @deprecated Use EntityMappers.buildFeedItemLookupMaps */
export const buildFeedItemLookupMaps = EntityMappers.buildFeedItemLookupMaps.bind(EntityMappers);

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


    const sortBy = sort === 'recent' ? 'createdAt' : 'score';
    const feedFilters = {
      impactArea,
      stage,
      beneficiaries,
      methods,
      helpNeeded,
      categories,
      valueTags,
    };
    const MAX_PINNED = 50;

    const fetchPinned = () =>
      this.deps.publicationService.getPublicationsByCommunity(
        communityId,
        MAX_PINNED,
        0,
        sortBy,
        tag,
        feedFilters,
        search,
        true,
        { pinnedOnly: true },
      );

    let pinnedPublications: Publication[] = [];
    let pinnedCount = 0;
    if (page === 1) {
      pinnedPublications = await fetchPinned();
      pinnedCount = pinnedPublications.length;
    } else {
      pinnedCount = (await fetchPinned()).length;
    }

    const unpinnedSkip =
      page === 1 ? 0 : Math.max(0, (page - 1) * limit - pinnedCount);

    // Merge publications + polls, then paginate. Independent per-source skip breaks
    // chronological feeds (older polls never surface when recent posts fill the window).
    const windowSize = unpinnedSkip + limit + limit;

    const [unpinnedPublications, polls] = await Promise.all([
      this.deps.publicationService.getPublicationsByCommunity(
        communityId,
        windowSize,
        0,
        sortBy,
        tag,
        feedFilters,
        search,
        true,
        { excludePinned: true },
      ),
      isFutureVision || hasCategoryFilters
        ? Promise.resolve([])
        : this.deps.pollService.getPollsByCommunity(
            communityId,
            windowSize,
            0,
            sortBy,
            search,
          ),
    ]);

    const publicationsForMaps =
      page === 1
        ? [...pinnedPublications, ...unpinnedPublications]
        : unpinnedPublications;

    const { usersMap, communitiesMap, logicalCommunitiesMap } =
      await buildDomainFeedMaps(
        publicationsForMaps,
        polls,
        this.deps.userService,
        this.deps.communityService,
      );

    const pinnedFeedItems =
      page === 1
        ? EntityMappers.mapPublicationsAndPollsToFeedItems(
            pinnedPublications,
            [],
            usersMap,
            communitiesMap,
            logicalCommunitiesMap,
            sortBy,
          )
        : [];

    const unpinnedFeedItems = EntityMappers.mapPublicationsAndPollsToFeedItems(
      unpinnedPublications,
      polls,
      usersMap,
      communitiesMap,
      logicalCommunitiesMap,
      sortBy,
    );

    const sortedUnpinned = EntityMappers.sortFeedItems(unpinnedFeedItems, sortBy);

    const feedItems =
      page === 1
        ? [
            ...pinnedFeedItems,
            ...sortedUnpinned.slice(0, Math.max(0, limit - pinnedCount)),
          ]
        : sortedUnpinned.slice(unpinnedSkip, unpinnedSkip + limit);

    const hasMore =
      sortedUnpinned.length > unpinnedSkip + limit ||
      unpinnedPublications.length === windowSize ||
      polls.length === windowSize;

    return {
      data: feedItems,
      pagination: {
        page,
        pageSize: limit,
        total: sortedUnpinned.length + (page === 1 ? pinnedCount : 0),
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

/** Router-only factory: build the use case straight from the tRPC context (no domain facade). */
export function createGetCommunityFeedUseCaseFromContext(
  ctx: GetCommunityFeedDeps,
): GetCommunityFeedUseCase {
  return createGetCommunityFeedUseCase({
    publicationService: ctx.publicationService,
    pollService: ctx.pollService,
    userService: ctx.userService,
    communityService: ctx.communityService,
  });
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
