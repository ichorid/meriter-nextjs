import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  Logger,
  Query,
} from '@nestjs/common';
import { UserServiceV2 } from '../../domain/services/user.service-v2';
import { PublicationServiceV2 } from '../../domain/services/publication.service-v2';
import { UserGuard } from '../../user.guard';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { User } from '../types/domain.types';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Controller('api/v1/users')
@UseGuards(UserGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly userService: UserServiceV2,
    private readonly publicationService: PublicationServiceV2,
  ) {}

  @Get(':userId')
  async getUser(@Param('userId') userId: string): Promise<User> {
    const user = await this.userService.getUser(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return this.mapUserToV1Format(user);
  }

  @Get(':userId/profile')
  async getUserProfile(@Param('userId') userId: string): Promise<User> {
    const user = await this.userService.getUser(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return this.mapUserToV1Format(user);
  }

  @Get(':userId/communities')
  async getUserCommunities(@Param('userId') userId: string, @Req() req: any) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.tgUserId : userId;
    
    // Users can only see their own communities
    if (actualUserId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    const communityIds = await this.userService.getUserCommunities(actualUserId);
    // TODO: Convert community IDs to full community objects using CommunityServiceV2
    return communityIds.map(id => ({ id, name: 'Community', description: '' }));
  }

  @Get(':userId/updates-frequency')
  async getUpdatesFrequency(@Param('userId') userId: string, @Req() req: any) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.tgUserId : userId;
    
    // Users can only see their own settings
    if (actualUserId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    // TODO: Implement user settings
    return { frequency: 'daily' };
  }

  @Put(':userId/updates-frequency')
  async updateUpdatesFrequency(
    @Param('userId') userId: string,
    @Body() body: { frequency: string },
    @Req() req: any,
  ) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.tgUserId : userId;
    
    // Users can only update their own settings
    if (actualUserId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    // TODO: Implement user settings update
    return { frequency: body.frequency };
  }

  @Get(':userId/publications')
  async getUserPublications(
    @Param('userId') userId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    
    const publications = await this.publicationService.getPublicationsByAuthor(
      userId,
      pagination.limit,
      skip
    );

    // Convert domain entities to DTOs
    const mappedPublications = publications.map(publication => ({
      id: publication.getId.getValue(),
      communityId: publication.getCommunityId.getValue(),
      authorId: publication.getAuthorId.getValue(),
      beneficiaryId: publication.getBeneficiaryId?.getValue() || undefined,
      content: publication.getContent,
      type: publication.getType,
      hashtags: publication.getHashtags,
      imageUrl: undefined, // Not available in current entity
      videoUrl: undefined, // Not available in current entity
      metadata: undefined, // Not available in current entity
      metrics: {
        upvotes: publication.getMetrics.upvotes,
        downvotes: publication.getMetrics.downvotes,
        upthanks: publication.getMetrics.upvotes,
        downthanks: publication.getMetrics.downvotes,
        score: publication.getMetrics.score,
        commentCount: publication.getMetrics.commentCount,
        viewCount: 0, // Not available in current entity
      },
      createdAt: publication.toSnapshot().createdAt.toISOString(),
      updatedAt: publication.toSnapshot().updatedAt.toISOString(),
    }));

    return PaginationHelper.createResult(mappedPublications, mappedPublications.length, pagination);
  }

  private mapUserToV1Format(user: any): User {
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      profile: {
        bio: user.bio,
        location: user.location,
        website: user.website,
        isVerified: user.isVerified,
      },
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
