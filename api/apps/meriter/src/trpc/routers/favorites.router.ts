import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { PaginationInputSchema } from '../../common/schemas/pagination.schema';
import { Publication } from '../../domain/aggregates/publication/publication.entity';
import { Poll } from '../../domain/aggregates/poll/poll.entity';
import type { PublicationSnapshot } from '../../common/interfaces/publication-document.interface';
import type { PollSnapshot } from '../../domain/aggregates/poll/poll.entity';
import type { FavoriteTargetType } from '../../domain/models/favorite/favorite.schema';
import type { FeedItem } from '@meriter/shared-types';
import {
  buildFeedItemLookupMaps,
  createMarkNotificationsReadUseCase,
  createToggleFavoriteUseCase,
} from '../../application/use-cases/feed/get-community-feed.use-case';

const FavoriteTargetTypeSchema = z.enum(['publication', 'poll', 'project']);

export const favoritesRouter = router({
  add: protectedProcedure
    .input(
      z.object({
        targetType: FavoriteTargetTypeSchema,
        targetId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const toggleFavorite = createToggleFavoriteUseCase({
        favoriteService: ctx.favoriteService,
      });
      await toggleFavorite.add(
        ctx.user.id,
        input.targetType as FavoriteTargetType,
        input.targetId,
      );
      return { success: true };
    }),

  remove: protectedProcedure
    .input(
      z.object({
        targetType: FavoriteTargetTypeSchema,
        targetId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const toggleFavorite = createToggleFavoriteUseCase({
        favoriteService: ctx.favoriteService,
      });
      await toggleFavorite.remove(
        ctx.user.id,
        input.targetType as FavoriteTargetType,
        input.targetId,
      );
      return { success: true };
    }),

  isFavorite: protectedProcedure
    .input(
      z.object({
        targetType: FavoriteTargetTypeSchema,
        targetId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const isFavorite = await ctx.favoriteService.isFavorite(
        ctx.user.id,
        input.targetType as FavoriteTargetType,
        input.targetId,
      );
      return { isFavorite };
    }),

  getCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.favoriteService.getFavoriteCount(ctx.user.id);
    return { count };
  }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.favoriteService.getUnreadCount(ctx.user.id);
    return { count };
  }),

  markAsViewed: protectedProcedure
    .input(
      z.object({
        targetType: FavoriteTargetTypeSchema,
        targetId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const markRead = createMarkNotificationsReadUseCase({
        favoriteService: ctx.favoriteService,
      });
      await markRead.execute(
        ctx.user.id,
        input.targetType as FavoriteTargetType,
        input.targetId,
      );
      return { success: true };
    }),

  getAll: protectedProcedure
    .input(PaginationInputSchema.optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page;
      const pageSize = input?.pageSize ?? input?.limit;

      const result = await ctx.favoriteService.getUserFavorites(ctx.user.id, {
        page,
        pageSize,
      });

      const favorites = result.data;

      const publicationIds: string[] = [];
      const pollIds: string[] = [];

      for (const fav of favorites) {
        if (fav.targetType === 'poll') {
          pollIds.push(fav.targetId);
        } else {
          publicationIds.push(fav.targetId);
        }
      }

      if (!ctx.connection.db) {
        return { items: [], total: 0 };
      }

      const [publicationDocs, pollDocs] = await Promise.all([
        publicationIds.length > 0
          ? ctx.connection.db
              .collection('publications')
              .find({ id: { $in: publicationIds } })
              .toArray()
          : Promise.resolve([]),
        pollIds.length > 0
          ? ctx.connection.db
              .collection('polls')
              .find({ id: { $in: pollIds } })
              .toArray()
          : Promise.resolve([]),
      ]);

      const publications = publicationDocs.map((doc) =>
        Publication.fromSnapshot(doc as unknown as PublicationSnapshot),
      );
      const polls = pollDocs.map((doc) => Poll.fromSnapshot(doc as unknown as PollSnapshot));

      const userIds = new Set<string>();
      const communityIds = new Set<string>();
      const authoredCommunityIds = new Set<string>();

      for (const pub of publications) {
        const s = pub.toSnapshot();
        userIds.add(pub.getAuthorId.getValue());
        if (pub.getBeneficiaryId) {
          userIds.add(pub.getBeneficiaryId.getValue());
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

      const [usersMap, communitiesMap] = await Promise.all([
        ctx.userEnrichmentService.batchFetchUsers(Array.from(userIds)),
        ctx.communityEnrichmentService.batchFetchCommunities(Array.from(communityIds)),
      ]);

      const logicalCommunitiesMap = new Map<
        string,
        { id: string; name?: string; avatarUrl?: string }
      >();
      await Promise.all(
        Array.from(authoredCommunityIds).map(async (cid) => {
          const c = await ctx.communityService.getCommunity(cid);
          if (c) {
            logicalCommunitiesMap.set(cid, {
              id: cid,
              name: (c as { name?: string }).name,
              avatarUrl: (c as { avatarUrl?: string }).avatarUrl,
            });
          }
        }),
      );

      const { publicationMap, pollMap } = buildFeedItemLookupMaps(
        publications,
        polls,
        usersMap,
        communitiesMap,
        logicalCommunitiesMap,
      );

      const data: Array<{
        favorite: {
          id: string;
          targetType: FavoriteTargetType;
          targetId: string;
          lastViewedAt: string | null;
          lastActivityAt: string | null;
          isUnread: boolean;
        };
        item: FeedItem;
      }> = favorites
        .map((fav) => {
          const item =
            fav.targetType === 'poll'
              ? pollMap.get(fav.targetId)
              : publicationMap.get(fav.targetId);

          const lastViewedAt = fav.lastViewedAt ? new Date(fav.lastViewedAt) : undefined;
          const lastActivityAt = fav.lastActivityAt ? new Date(fav.lastActivityAt) : undefined;
          const isUnread =
            !!lastActivityAt &&
            lastActivityAt.getTime() >
              (lastViewedAt?.getTime() ?? new Date(0).getTime());

          return {
            favorite: {
              id: fav.id,
              targetType: fav.targetType,
              targetId: fav.targetId,
              lastViewedAt: fav.lastViewedAt?.toISOString?.() ?? null,
              lastActivityAt: fav.lastActivityAt?.toISOString?.() ?? null,
              isUnread,
            },
            item: item ?? null,
          };
        })
        .filter(
          (
            x,
          ): x is {
            favorite: {
              id: string;
              targetType: FavoriteTargetType;
              targetId: string;
              lastViewedAt: string | null;
              lastActivityAt: string | null;
              isUnread: boolean;
            };
            item: FeedItem;
          } => x.item !== null,
        );

      return {
        data,
        total: result.pagination.total,
        page: result.pagination.page,
        pageSize: result.pagination.limit,
      };
    }),
});
