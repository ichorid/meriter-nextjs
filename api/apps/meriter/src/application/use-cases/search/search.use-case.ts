import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { isProjectCommunity } from '../../../domain/services/community.service';
import type { CommunityService } from '../../../domain/services/community.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';

export type SearchResultItem = {
  type: string;
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  url: string;
  author?: { id: string; name: string; avatarUrl?: string };
  community?: { id: string; name: string; avatarUrl?: string };
};

export type SearchPublicationsInput = {
  query?: string;
  tags?: string[];
  authorId?: string;
  communityId?: string;
  page?: number;
  pageSize?: number;
};

export type SearchCommunitiesInput = {
  query?: string;
};

export type SearchContext = {
  user: { id: string };
  publicationService: PublicationService;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
};

/**
 * BC-03: unified search orchestration for publications and communities.
 * Extracted from search.router search procedure.
 */
export class SearchUseCase {
  constructor(private readonly ctx: SearchContext) {}

  async searchPublications(input: SearchPublicationsInput): Promise<SearchResultItem[]> {
    const { query, tags, authorId, communityId, page = 1, pageSize = 20 } = input;
    const results: SearchResultItem[] = [];

    try {
      const pagination = PaginationHelper.parseOptions({ page, limit: pageSize });
      const skip = PaginationHelper.getSkip(pagination);

      let publications: any[] = [];
      if (communityId) {
        const result = await this.ctx.publicationService.getPublicationsByCommunity(
          communityId,
          pagination.limit || 100,
          skip,
          undefined,
          undefined,
          undefined,
          undefined,
          true,
        );
        publications = result.map((p) => p.toSnapshot());
      } else {
        const userRoles = await this.ctx.userCommunityRoleService.getUserRoles(this.ctx.user.id);
        const userCommunityIds = userRoles.map((role) => role.communityId);

        const allPublications = await Promise.all(
          userCommunityIds.map((cid) =>
            this.ctx.publicationService.getPublicationsByCommunity(
              cid,
              50,
              0,
              undefined,
              undefined,
              undefined,
              undefined,
              true,
            ),
          ),
        );
        publications = allPublications.flat().map((p) => p.toSnapshot());
      }

      for (const pub of publications) {
        if (query) {
          const searchText = `${pub.title || ''} ${pub.content || ''}`.toLowerCase();
          if (!searchText.includes(query.toLowerCase())) {
            continue;
          }
        }

        if (authorId && pub.authorId !== authorId) {
          continue;
        }

        if (tags && tags.length > 0) {
          const pubTags = pub.hashtags || [];
          if (!tags.some((tag) => pubTags.includes(tag))) {
            continue;
          }
        }

        const [author, community] = await Promise.all([
          pub.authorId ? this.ctx.userService.getUser(pub.authorId) : null,
          pub.communityId ? this.ctx.communityService.getCommunity(pub.communityId) : null,
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
    } catch (_error) {
      // Continue with other content types if publications search fails
    }

    return results;
  }

  async searchCommunities(input: SearchCommunitiesInput): Promise<SearchResultItem[]> {
    const { query } = input;
    const results: SearchResultItem[] = [];

    try {
      const allCommunities = await this.ctx.communityService.getAllCommunities(100, 0, {
        excludeProjects: true,
      });

      allCommunities.forEach((comm) => {
        if (isProjectCommunity(comm)) return;
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
    } catch (_error) {
      // Continue with other content types if communities search fails
    }

    return results;
  }
}

export function createSearchUseCase(ctx: SearchContext): SearchUseCase {
  return new SearchUseCase(ctx);
}
