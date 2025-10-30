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
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { UserService } from '../../domain/services/user.service';
import { PublicationService } from '../../domain/services/publication.service';
import { CommentService } from '../../domain/services/comment.service';
import { UserGuard } from '../../user.guard';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { User, UpdatesFrequencySchema } from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Controller('api/v1/users')
@UseGuards(UserGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly userService: UserService,
    private readonly publicationService: PublicationService,
    private readonly commentService: CommentService,
    @InjectConnection() private mongoose: Connection,
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
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only see their own communities
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }
    const communityIds = await this.userService.getUserCommunities(actualUserId);
    // TODO: Convert community IDs to full community objects using CommunityService
    return communityIds.map(id => ({ id, name: 'Community', description: '' }));
  }

  @Get(':userId/updates-frequency')
  async getUpdatesFrequency(@Param('userId') userId: string, @Req() req: any) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only see their own settings
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }
    // TODO: Implement user settings
    return { frequency: 'daily' };
  }

  @Put(':userId/updates-frequency')
  @ZodValidation(UpdatesFrequencySchema)
  async updateUpdatesFrequency(
    @Param('userId') userId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only update their own settings
    if (actualUserId !== req.user.id) {
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
        score: publication.getMetrics.score,
        commentCount: publication.getMetrics.commentCount,
        viewCount: 0, // Not available in current entity
      },
      createdAt: publication.toSnapshot().createdAt.toISOString(),
      updatedAt: publication.toSnapshot().updatedAt.toISOString(),
    }));

    return PaginationHelper.createResult(mappedPublications, mappedPublications.length, pagination);
  }

  @Get(':userId/updates')
  async getUserUpdates(
    @Param('userId') userId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only see their own updates
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }

    const pagination = PaginationHelper.parseOptions(query);
    const limit = pagination.limit;
    const skip = PaginationHelper.getSkip(pagination);

    // Get user's publication IDs (where user is author)
    const userPublications = await this.publicationService.getPublicationsByAuthor(
      actualUserId,
      1000, // Get all for filtering
      0
    );
    const userPublicationIds = userPublications.length > 0 
      ? userPublications.map(p => p.getId.getValue())
      : [];

    // Get user's comment IDs (where user is author)
    const userComments = await this.commentService.getCommentsByAuthor(
      actualUserId,
      1000, // Get all for filtering
      0
    );
    const userCommentIds = userComments.length > 0
      ? userComments.map(c => c.getId)
      : [];

    // Get publications where user is beneficiary
    const beneficiaryPublications = await this.mongoose.db
      .collection('publications')
      .find({
        beneficiaryId: actualUserId,
      })
      .project({ id: 1, authorId: 1, communityId: 1, createdAt: 1 })
      .toArray();

    // Query votes on user's publications and comments
    const voteUpdatesRaw = userPublicationIds.length > 0 || userCommentIds.length > 0
      ? await this.mongoose.db
          .collection('votes')
          .find({
            $or: [
              ...(userPublicationIds.length > 0 ? [{ targetType: 'publication', targetId: { $in: userPublicationIds } }] : []),
              ...(userCommentIds.length > 0 ? [{ targetType: 'comment', targetId: { $in: userCommentIds } }] : []),
            ],
            userId: { $ne: actualUserId }, // Exclude user's own votes
          })
          .toArray()
      : [];

    // Enrich votes with publication/comment info
    const voteUpdates = await Promise.all(
      voteUpdatesRaw.map(async (vote: any) => {
        let publicationId = vote.targetId;
        let communityId: string | undefined;

        if (vote.targetType === 'publication') {
          // For publication votes, get communityId from publication
          const pub = await this.publicationService.getPublication(vote.targetId);
          if (pub) {
            communityId = pub.getCommunityId.getValue();
          }
        } else {
          // For comment votes, get publicationId and communityId from comment
          const comment = await this.commentService.getComment(vote.targetId);
          if (comment) {
            publicationId = comment.getTargetId;
            // Get communityId from the publication
            if (comment.getTargetType === 'publication') {
              const pub = await this.publicationService.getPublication(publicationId);
              if (pub) {
                communityId = pub.getCommunityId.getValue();
              }
            }
          }
        }

        return {
          id: `vote-${vote._id}`,
          eventType: 'vote',
          userId: vote.userId,
          amount: vote.amount,
          direction: vote.amount > 0 ? 'up' : 'down',
          targetType: vote.targetType,
          targetId: vote.targetId,
          publicationId,
          communityId,
          createdAt: vote.createdAt,
        };
      })
    );

    // Transform beneficiary publications into update events
    const beneficiaryUpdates = beneficiaryPublications.map((pub: any) => ({
      id: `beneficiary-${pub._id}`,
      eventType: 'beneficiary',
      authorId: pub.authorId,
      publicationId: pub.id,
      communityId: pub.communityId,
      createdAt: pub.createdAt,
    }));

    // Merge and sort all updates
    const allUpdates = [...voteUpdates, ...beneficiaryUpdates].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Get unique actor IDs (voters and authors)
    const actorIds = new Set<string>();
    voteUpdates.forEach((v: any) => actorIds.add(v.userId));
    beneficiaryUpdates.forEach((b: any) => actorIds.add(b.authorId));

    // Fetch actor information
    const actors = await this.mongoose.db
      .collection('users')
      .find({ id: { $in: Array.from(actorIds) } })
      .project({ id: 1, displayName: 1, username: 1, avatarUrl: 1 })
      .toArray();

    const actorsMap = new Map(actors.map((a: any) => [a.id, a]));

    // Enrich updates with actor information
    const enrichedUpdates = allUpdates.map((update: any) => {
      const actorId = update.userId || update.authorId;
      const actor = actorsMap.get(actorId);

      return {
        id: update.id,
        eventType: update.eventType,
        actor: {
          id: actorId,
          name: actor?.displayName || 'Unknown',
          username: actor?.username,
          avatarUrl: actor?.avatarUrl,
        },
        targetType: update.targetType || 'publication',
        targetId: update.targetId || update.publicationId,
        publicationId: update.publicationId,
        publicationSlug: undefined, // Can be added later if needed
        communityId: update.communityId,
        amount: update.amount,
        direction: update.direction,
        createdAt: update.createdAt?.toISOString() || new Date().toISOString(),
      };
    });

    // Apply pagination
    const paginatedUpdates = enrichedUpdates.slice(skip, skip + limit);

    return PaginationHelper.createResult(paginatedUpdates, enrichedUpdates.length, pagination);
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
        bio: user.profile?.bio,
        location: user.profile?.location,
        website: user.profile?.website,
        isVerified: user.profile?.isVerified,
      },
      communityTags: user.communityTags || [],
      communityMemberships: user.communityMemberships || [],
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
