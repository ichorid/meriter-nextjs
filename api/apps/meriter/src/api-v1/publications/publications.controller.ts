import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { PublicationService } from '../../domain/services/publication.service';
import { UserService } from '../../domain/services/user.service';
import { CommunityService } from '../../domain/services/community.service';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreatePublicationDto } from '../../../../../../libs/shared-types/dist/index';

@Controller('api/v1/publications')
@UseGuards(UserGuard)
export class PublicationsController {
  constructor(
    private publicationService: PublicationService,
    private userService: UserService,
    private communityService: CommunityService,
  ) {}

  @Post()
  async createPublication(
    @User() user: AuthenticatedUser,
    @Body() dto: CreatePublicationDto,
  ) {
    const publication = await this.publicationService.createPublication(user.id, dto);
    return { success: true, data: publication };
  }

  @Get(':id')
  async getPublication(@Param('id') id: string) {
    const publication = await this.publicationService.getPublication(id);
    
    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    // Transform domain entity to DTO format with enriched metadata
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue();
    const communityId = publication.getCommunityId.getValue();

    // Fetch author, beneficiary, and community in parallel
    const [author, beneficiary, community] = await Promise.all([
      this.userService.getUser(authorId),
      beneficiaryId ? this.userService.getUser(beneficiaryId) : Promise.resolve(null),
      this.communityService.getCommunity(communityId),
    ]);

    const mappedPublication = {
      id: publication.getId.getValue(),
      _id: publication.getId.getValue(), // For compatibility with Publication component
      slug: publication.getId.getValue(), // Use id as slug for navigation
      communityId,
      authorId,
      beneficiaryId: beneficiaryId || undefined,
      content: publication.getContent,
      type: publication.getType,
      hashtags: publication.getHashtags,
      imageUrl: undefined, // Not available in current entity
      videoUrl: undefined, // Not available in current entity
      metrics: {
        upvotes: publication.getMetrics.upvotes,
        downvotes: publication.getMetrics.downvotes,
        score: publication.getMetrics.score,
        commentCount: publication.getMetrics.commentCount,
        viewCount: 0, // Not available in current entity
      },
      meta: {
        author: {
          id: authorId,
          name: author?.displayName || author?.firstName || 'Unknown',
          photoUrl: author?.avatarUrl,
          username: author?.username,
        },
        ...(beneficiary && {
          beneficiary: {
            id: beneficiaryId,
            name: beneficiary.displayName || beneficiary.firstName || 'Unknown',
            photoUrl: beneficiary.avatarUrl,
            username: beneficiary.username,
          },
        }),
        ...(community && {
          origin: {
            telegramChatName: community.name,
          },
        }),
      },
      createdAt: publication.toSnapshot().createdAt.toISOString(),
      updatedAt: publication.toSnapshot().updatedAt.toISOString(),
    };

    return { success: true, data: mappedPublication };
  }

  @Get()
  async getPublications(
    @Query('communityId') communityId?: string,
    @Query('authorId') authorId?: string,
    @Query('hashtag') hashtag?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    // Support both pagination formats: limit/skip and page/pageSize
    let parsedLimit = 20;
    let parsedSkip = 0;
    
    if (pageSize) {
      parsedLimit = parseInt(pageSize, 10);
    } else if (limit) {
      parsedLimit = parseInt(limit, 10);
    }
    
    if (page && pageSize) {
      parsedSkip = (parseInt(page, 10) - 1) * parsedLimit;
    } else if (skip) {
      parsedSkip = parseInt(skip, 10);
    }

    if (communityId) {
      return this.publicationService.getPublicationsByCommunity(communityId, parsedLimit, parsedSkip);
    }
    
    if (authorId) {
      const publications = await this.publicationService.getPublicationsByAuthor(authorId, parsedLimit, parsedSkip);

      // Extract unique user IDs (authors and beneficiaries)
      const userIds = new Set<string>();
      const communityIds = new Set<string>();
      publications.forEach(pub => {
        userIds.add(pub.getAuthorId.getValue());
        if (pub.getBeneficiaryId) {
          userIds.add(pub.getBeneficiaryId.getValue());
        }
        communityIds.add(pub.getCommunityId.getValue());
      });

      // Batch fetch all users
      const usersMap = new Map<string, any>();
      await Promise.all(
        Array.from(userIds).map(async (userId) => {
          const user = await this.userService.getUser(userId);
          if (user) {
            usersMap.set(userId, user);
          }
        })
      );

      // Batch fetch all communities
      const communitiesMap = new Map<string, any>();
      await Promise.all(
        Array.from(communityIds).map(async (communityId) => {
          const community = await this.communityService.getCommunity(communityId);
          if (community) {
            communitiesMap.set(communityId, community);
          }
        })
      );

      // Convert domain entities to DTOs with enriched user metadata
      const mappedPublications = publications.map(publication => {
        const authorId = publication.getAuthorId.getValue();
        const beneficiaryId = publication.getBeneficiaryId?.getValue();
        const communityId = publication.getCommunityId.getValue();
        const author = usersMap.get(authorId);
        const beneficiary = beneficiaryId ? usersMap.get(beneficiaryId) : null;
        const community = communitiesMap.get(communityId);

        return {
          id: publication.getId.getValue(),
          communityId,
          authorId,
          beneficiaryId: beneficiaryId || undefined,
          content: publication.getContent,
          type: publication.getType,
          hashtags: publication.getHashtags,
          imageUrl: undefined, // Not available in current entity
          videoUrl: undefined, // Not available in current entity
          metrics: {
            upvotes: publication.getMetrics.upvotes,
            downvotes: publication.getMetrics.downvotes,
            score: publication.getMetrics.score,
            commentCount: publication.getMetrics.commentCount,
            viewCount: 0, // Not available in current entity
          },
          meta: {
            author: {
              id: authorId,
              name: author?.displayName || author?.firstName || 'Unknown',
              photoUrl: author?.avatarUrl,
              username: author?.username,
            },
            ...(beneficiary && {
              beneficiary: {
                id: beneficiaryId,
                name: beneficiary.displayName || beneficiary.firstName || 'Unknown',
                photoUrl: beneficiary.avatarUrl,
                username: beneficiary.username,
              },
            }),
            ...(community && {
              origin: {
                telegramChatName: community.name,
              },
            }),
          },
          createdAt: publication.toSnapshot().createdAt.toISOString(),
          updatedAt: publication.toSnapshot().updatedAt.toISOString(),
        };
      });

      return { success: true, data: mappedPublications };
    }

    if (hashtag) {
      return this.publicationService.getPublicationsByHashtag(hashtag, parsedLimit, parsedSkip);
    }

    return this.publicationService.getTopPublications(parsedLimit, parsedSkip);
  }

  @Put(':id')
  async updatePublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updates: Partial<{
      content: string;
      hashtags: string[];
    }>,
  ) {
    return this.publicationService.updatePublication(id, user.id, updates);
  }

  @Delete(':id')
  async deletePublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.publicationService.deletePublication(id, user.id);
    return { success: true };
  }

  @Post(':id/vote')
  async voteOnPublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { amount: number; direction: 'up' | 'down' },
  ) {
    return this.publicationService.voteOnPublication(id, user.id, dto.amount, dto.direction);
  }
}
