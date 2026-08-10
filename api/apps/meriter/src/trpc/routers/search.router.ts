import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import {
  createSearchUseCase,
  type SearchResultItem,
} from '../../application/use-cases/search/search.use-case';

export const searchRouter = router({
  /**
   * Unified search across all content types
   * Aggregates results from publications, communities, polls, and users
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        contentType: z
          .enum(['all', 'publications', 'comments', 'polls', 'communities', 'users'])
          .optional()
          .default('all'),
        tags: z.array(z.string()).optional(),
        authorId: z.string().optional(),
        communityId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(100).optional().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        query,
        contentType = 'all',
        tags,
        authorId,
        communityId,
        dateFrom: _dateFrom,
        dateTo: _dateTo,
        page = 1,
        pageSize = 20,
      } = input;

      // If no query and no filters, return empty results
      if (!query && !tags?.length && !authorId && !communityId) {
        return {
          results: [],
          meta: {
            total: 0,
            contentType,
            page,
            pageSize,
          },
        };
      }

      const results: SearchResultItem[] = [];
      const searchUseCase = createSearchUseCase({
        user: ctx.user,
        publicationService: ctx.publicationService,
        communityService: ctx.communityService,
        userCommunityRoleService: ctx.userCommunityRoleService,
        userService: ctx.userService,
      });

      // Search publications
      if (contentType === 'all' || contentType === 'publications') {
        const publicationResults = await searchUseCase.searchPublications({
          query,
          tags,
          authorId,
          communityId,
          page,
          pageSize,
        });
        results.push(...publicationResults);
      }

      // Search communities
      if (contentType === 'all' || contentType === 'communities') {
        const communityResults = await searchUseCase.searchCommunities({ query });
        results.push(...communityResults);
      }

      // Search polls
      if (contentType === 'all' || contentType === 'polls') {
        try {
          const pagination = PaginationHelper.parseOptions({ page, limit: pageSize });
          const skip = PaginationHelper.getSkip(pagination);

          let polls: any[] = [];
          if (communityId) {
            const result = await ctx.pollService.getPollsByCommunity(
              communityId,
              pagination.limit || 100, // Get more to filter
              skip,
            );
            polls = result.map((p) => p.toSnapshot());
          } else {
            // For now, search only in user's communities
            const userRoles = await ctx.userCommunityRoleService.getUserRoles(ctx.user.id);
            const userCommunityIds = userRoles.map((role) => role.communityId);
            
            // Get polls from all user's communities
            const allPolls = await Promise.all(
              userCommunityIds.map((cid) =>
                ctx.pollService.getPollsByCommunity(cid, 50, 0),
              ),
            );
            polls = allPolls.flat().map((p) => p.toSnapshot());
          }

          await Promise.all(
            polls.map(async (poll) => {
              if (query) {
                const searchText = `${poll.question || poll.title || ''} ${
                  poll.description || ''
                }`.toLowerCase();
                if (!searchText.includes(query.toLowerCase())) {
                  return;
                }
              }

              // Filter by author if provided
              if (authorId && poll.authorId !== authorId) {
                return;
              }

              // Get community info
              const community = poll.communityId
                ? await ctx.communityService.getCommunity(poll.communityId)
                : null;

              results.push({
                type: 'polls',
                id: poll.id,
                title: poll.question || poll.title || 'Untitled Poll',
                description: poll.description,
                createdAt: poll.createdAt?.toISOString() || new Date().toISOString(),
                url: `/meriter/communities/${poll.communityId}/polls/${poll.id}`,
                community: community
                  ? {
                      id: community.id,
                      name: community.name || 'Unknown',
                      avatarUrl: community.avatarUrl,
                    }
                  : undefined,
              });
            })
          );
        } catch (_error) {
          // Continue with other content types if polls search fails
        }
      }

      // Search users (admin only)
      if ((contentType === 'all' || contentType === 'users') && ctx.user.globalRole === 'superadmin') {
        try {
          if (query && query.length >= 2) {
            const users = await ctx.userService.searchUsers(query, 20);
            users.forEach((user) => {
              results.push({
                type: 'users',
                id: user.id,
                title: user.displayName || user.username || 'Unknown User',
                description: user.profile?.bio,
                createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
                url: `/meriter/users/${user.id}`,
                author: {
                  id: user.id,
                  name: user.displayName || user.username || 'Unknown',
                  avatarUrl: user.avatarUrl,
                },
              });
            });
          }
        } catch (_error) {
          // Continue if user search fails
        }
      }

      // Sort results by relevance (for now, just by creation date)
      results.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      // Apply pagination
      const paginatedResults = results.slice((page - 1) * pageSize, page * pageSize);

      return {
        results: paginatedResults,
        meta: {
          total: results.length,
          contentType,
          page,
          pageSize,
        },
      };
    }),
});
