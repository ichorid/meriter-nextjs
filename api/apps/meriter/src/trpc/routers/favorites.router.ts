import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { PaginationInputSchema } from '../../common/schemas/pagination.schema';
import { Publication } from '../../domain/aggregates/publication/publication.entity';
import { Poll } from '../../domain/aggregates/poll/poll.entity';
import type { PublicationSnapshot } from '../../common/interfaces/publication-document.interface';
import type { PollSnapshot } from '../../domain/aggregates/poll/poll.entity';
import type { FavoriteTargetType } from '../../domain/models/favorite/favorite.schema';
import type { FeedItem, PublicationFeedItem, PollFeedItem } from '@meriter/shared-types';

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
      await ctx.favoriteService.addFavorite(
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
      await ctx.favoriteService.removeFavorite(
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
      await ctx.favoriteService.markAsViewed(
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
          // publication + project are stored in publications collection
          publicationIds.push(fav.targetId);
        }
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
        Publication.fromSnapshot(doc as PublicationSnapshot),
      );
      const polls = pollDocs.map((doc) => Poll.fromSnapshot(doc as PollSnapshot));

      // Collect IDs for enrichment
      const userIds = new Set<string>();
      const communityIds = new Set<string>();

      for (const pub of publications) {
        userIds.add(pub.getAuthorId.getValue());
        if (pub.getBeneficiaryId) {
          userIds.add(pub.getBeneficiaryId.getValue());
        }
        communityIds.add(pub.getCommunityId.getValue());
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

      type EnrichedUser = {
        displayName?: string;
        firstName?: string;
        username?: string;
        avatarUrl?: string;
      };
      type EnrichedCommunity = { name?: string };

      const typedUsersMap = usersMap as Map<string, EnrichedUser>;
      const typedCommunitiesMap = communitiesMap as Map<string, EnrichedCommunity>;

      const publicationMap = new Map<string, PublicationFeedItem>();
      for (const pub of publications) {
        const snapshot = pub.toSnapshot();
        const authorId = pub.getAuthorId.getValue();
        const beneficiaryId = pub.getBeneficiaryId?.getValue();
        const author = typedUsersMap.get(authorId);
        const beneficiary = beneficiaryId ? typedUsersMap.get(beneficiaryId) : undefined;
        const community = typedCommunitiesMap.get(snapshot.communityId);

        const item: PublicationFeedItem = {
          id: snapshot.id,
          type: 'publication',
          communityId: snapshot.communityId,
          authorId,
          beneficiaryId: beneficiaryId || undefined,
          content: snapshot.content,
          slug: snapshot.id,
          title: snapshot.title || undefined,
          description: snapshot.description || undefined,
          postType: snapshot.postType || 'basic',
          isProject: snapshot.isProject || false,
          hashtags: snapshot.hashtags || [],
          imageUrl: snapshot.imageUrl || undefined,
          images: snapshot.images || undefined,
          impactArea: snapshot.impactArea || undefined,
          stage: snapshot.stage || undefined,
          beneficiaries:
            snapshot.beneficiaries && snapshot.beneficiaries.length > 0
              ? snapshot.beneficiaries
              : undefined,
          methods:
            snapshot.methods && snapshot.methods.length > 0 ? snapshot.methods : undefined,
          helpNeeded:
            snapshot.helpNeeded && snapshot.helpNeeded.length > 0
              ? snapshot.helpNeeded
              : undefined,
          metrics: {
            upvotes: snapshot.metrics.upvotes,
            downvotes: snapshot.metrics.downvotes,
            score: snapshot.metrics.upvotes - snapshot.metrics.downvotes,
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
            ...(community?.name && {
              origin: { telegramChatName: community.name },
            }),
          },
          createdAt: snapshot.createdAt.toISOString(),
          updatedAt: snapshot.updatedAt.toISOString(),
        };

        publicationMap.set(item.id, item);
      }

      const pollMap = new Map<string, PollFeedItem>();
      for (const poll of polls) {
        const snapshot = poll.toSnapshot();
        const author = typedUsersMap.get(snapshot.authorId);
        const community = typedCommunitiesMap.get(snapshot.communityId);

        const item: PollFeedItem = {
          id: snapshot.id,
          type: 'poll',
          communityId: snapshot.communityId,
          authorId: snapshot.authorId,
          question: snapshot.question,
          description: snapshot.description,
          slug: snapshot.id,
          options: snapshot.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            votes: opt.votes,
            amount: opt.amount,
            casterCount: opt.casterCount,
          })),
          expiresAt: snapshot.expiresAt.toISOString(),
          isActive: snapshot.isActive,
          metrics: {
            totalCasts: snapshot.metrics.totalCasts,
            casterCount: snapshot.metrics.casterCount,
            totalAmount: snapshot.metrics.totalAmount,
          },
          meta: {
            author: {
              name: author?.displayName || author?.firstName || 'Unknown',
              username: author?.username,
              photoUrl: author?.avatarUrl,
            },
            ...(community?.name && {
              origin: { telegramChatName: community.name },
            }),
          },
          createdAt: snapshot.createdAt.toISOString(),
          updatedAt: snapshot.updatedAt.toISOString(),
        };

        pollMap.set(item.id, item);
      }

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


