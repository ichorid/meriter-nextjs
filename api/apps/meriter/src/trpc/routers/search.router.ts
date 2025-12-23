import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

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
        dateFrom,
        dateTo,
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

      const results: Array<{
        type: string;
        id: string;
        title: string;
        description?: string;
        createdAt: string;
        url: string;
        author?: { id: string; name: string; avatarUrl?: string };
        community?: { id: string; name: string; avatarUrl?: string };
      }> = [];

      // Search publications
      if (contentType === 'all' || contentType === 'publications') {
        try {
          const pagination = PaginationHelper.parseOptions({ page, limit: pageSize });
          const skip = PaginationHelper.getSkip(pagination);

          let publications: any[] = [];
          if (communityId) {
            const result = await ctx.publicationService.getPublicationsByCommunity(
              communityId,
              pagination.limit || 100, // Get more to filter
              skip,
            );
            publications = result.map((p) => p.toSnapshot());
          } else {
            // For now, search only in user's communities
            const userRoles = await ctx.userCommunityRoleService.getUserRoles(ctx.user.id);
            const userCommunityIds = userRoles.map((role) => role.communityId);
            
            // Get publications from all user's communities
            const allPublications = await Promise.all(
              userCommunityIds.map((cid) =>
                ctx.publicationService.getPublicationsByCommunity(cid, 50, 0),
              ),
            );
            publications = allPublications.flat().map((p) => p.toSnapshot());
          }

          // Filter by query if provided and process publications
          for (const pub of publications) {
            if (query) {
              const searchText = `${pub.title || ''} ${pub.content || ''}`.toLowerCase();
              if (!searchText.includes(query.toLowerCase())) {
                continue;
              }
            }

            // Filter by author if provided
            if (authorId && pub.authorId !== authorId) {
              continue;
            }

            // Filter by tags if provided
            if (tags && tags.length > 0) {
              const pubTags = pub.hashtags || [];
              if (!tags.some((tag) => pubTags.includes(tag))) {
                continue;
              }
            }

            // Get author and community info
            const [author, community] = await Promise.all([
              pub.authorId ? ctx.userService.getUser(pub.authorId) : null,
              pub.communityId ? ctx.communityService.getCommunity(pub.communityId) : null,
            ]);

            results.push({
              type: 'publications',
              id: pub.id,
              title: pub.title || 'Untitled Publication',
              description: pub.description || pub.content,
              createdAt: pub.createdAt?.toISOString() || new Date().toISOString(),
              url: `/meriter/communities/${pub.communityId}/publications/${pub.id}`,
              author: author
                ? {
                    id: author.id,
                    name: author.displayName || author.username || 'Unknown',
                    avatarUrl: author.avatarUrl,
                  }
                : undefined,
              community: community
                ? {
                    id: community.id,
                    name: community.name || 'Unknown',
                    avatarUrl: community.avatarUrl,
                  }
                : undefined,
            });
          }
        } catch (error) {
          // Continue with other content types if publications search fails
        }
      }

      // Search communities
      if (contentType === 'all' || contentType === 'communities') {
        try {
          const allCommunities = await ctx.communityService.getAllCommunities(100, 0);

          allCommunities.forEach((comm) => {
            if (query) {
              const searchText = `${comm.name || ''} ${comm.description || ''}`.toLowerCase();
              if (!searchText.includes(query.toLowerCase())) {
                return;
              }
            }

            results.push({
              type: 'communities',
              id: comm.id,
              title: comm.name || 'Unnamed Community',
              description: comm.description,
              createdAt: comm.createdAt?.toISOString() || new Date().toISOString(),
              url: `/meriter/communities/${comm.id}`,
            });
          });
        } catch (error) {
          // Continue with other content types if communities search fails
        }
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

          polls.forEach((poll) => {
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
              ? ctx.communityService.getCommunity(poll.communityId)
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
          });
        } catch (error) {
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
        } catch (error) {
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

