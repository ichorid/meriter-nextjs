import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { CommunityServiceV2 } from '../../domain/services/community.service-v2';
import { PublicationServiceV2 } from '../../domain/services/publication.service-v2';
import { UserServiceV2 } from '../../domain/services/user.service-v2';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Community, UpdateCommunityDto } from '../types/domain.types';

@Controller('api/v1/communities')
@UseGuards(UserGuard)
export class CommunitiesController {
  private readonly logger = new Logger(CommunitiesController.name);

  constructor(
    private readonly communityService: CommunityServiceV2,
    private readonly publicationService: PublicationServiceV2,
    private readonly userService: UserServiceV2,
    private readonly tgBotsService: TgBotsService,
  ) {}

  /**
   * Helper to safely convert hashtagDescriptions from MongoDB Map to plain object.
   * When using .lean(), Mongoose returns a plain object instead of a Map.
   */
  private convertHashtagDescriptions(descriptions: any): Record<string, string> | undefined {
    if (!descriptions) return undefined;
    if (descriptions instanceof Map) {
      return Object.fromEntries(descriptions);
    }
    // Already a plain object from .lean()
    return descriptions as Record<string, string>;
  }

  @Get()
  async getCommunities(@Query() query: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const result = await this.communityService.getAllCommunities(pagination.limit, skip);
    return { data: result, total: result.length, skip, limit: pagination.limit };
  }

  @Get(':id')
  async getCommunity(@Param('id') id: string, @Req() req: any): Promise<Community> {
    const community = await this.communityService.getCommunity(id);
    if (!community) {
      throw new NotFoundError('Community', id);
    }
    
    return {
      ...community,
      hashtagDescriptions: this.convertHashtagDescriptions(community.hashtagDescriptions),
      isAdmin: await this.communityService.isUserAdmin(id, req.user.tgUserId),
      needsSetup: (
        !community.hashtags || 
        community.hashtags.length === 0 ||
        !community.settings?.currencyNames?.singular ||
        community.settings.currencyNames.singular === 'merit' ||
        !community.settings?.currencyNames?.plural ||
        !community.settings?.currencyNames?.genitive ||
        !community.settings?.iconUrl
      ),
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    };
  }

  @Post()
  async createCommunity(@Body() createDto: any, @Req() req: any): Promise<Community> {
    const community = await this.communityService.createCommunity(createDto);
    
    return {
      ...community,
      hashtagDescriptions: this.convertHashtagDescriptions(community.hashtagDescriptions),
      isAdmin: true, // Creator is admin
      needsSetup: (
        !community.hashtags || 
        community.hashtags.length === 0 ||
        !community.settings?.currencyNames?.singular ||
        community.settings.currencyNames.singular === 'merit' ||
        !community.settings?.currencyNames?.plural ||
        !community.settings?.currencyNames?.genitive ||
        !community.settings?.iconUrl
      ),
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    };
  }

  @Put(':id')
  async updateCommunity(
    @Param('id') id: string,
    @Body() updateDto: UpdateCommunityDto,
    @Req() req: any,
  ): Promise<Community> {
    const isAdmin = await this.communityService.isUserAdmin(id, req.user.tgUserId);
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can update community settings');
    }

    const community = await this.communityService.updateCommunity(id, updateDto);
    
    return {
      ...community,
      hashtagDescriptions: this.convertHashtagDescriptions(community.hashtagDescriptions),
      isAdmin: await this.communityService.isUserAdmin(id, req.user.tgUserId),
      needsSetup: (
        !community.hashtags || 
        community.hashtags.length === 0 ||
        !community.settings?.currencyNames?.singular ||
        community.settings.currencyNames.singular === 'merit' ||
        !community.settings?.currencyNames?.plural ||
        !community.settings?.currencyNames?.genitive ||
        !community.settings?.iconUrl
      ),
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    };
  }

  @Delete(':id')
  async deleteCommunity(@Param('id') id: string, @Req() req: any) {
    const isAdmin = await this.communityService.isUserAdmin(id, req.user.tgUserId);
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can delete communities');
    }

    await this.communityService.deleteCommunity(id);
    return { success: true, data: { message: 'Community deleted successfully' } };
  }

  // TODO: Implement getCommunityMembers in CommunityServiceV2
  // @Get(':id/members')
  // async getCommunityMembers(@Param('id') id: string, @Query() query: any) {
  //   const pagination = PaginationHelper.parseOptions(query);
  //   const result = await this.communityService.getCommunityMembers(id, pagination);
  //   return result;
  // }

  @Post('sync')
  async syncCommunities(@Req() req: any) {
    const userId = req.user.tgUserId;
    this.logger.log(`Syncing communities for user: ${userId}`);
    
    try {
      // Get all active communities
      const allCommunities = await this.communityService.getAllCommunities(1000, 0);
      this.logger.log(`Found ${allCommunities.length} active communities`);

      const communityChatIds: string[] = [];
      let syncedCount = 0;

      // Check membership for each community (only active communities)
      for (const community of allCommunities) {
        // Skip inactive communities
        if (!community.isActive) {
          this.logger.log(`Skipping inactive community: ${community.name}`);
          continue;
        }
        
        try {
          const isMember = await this.tgBotsService.tgGetChatMember(
            community.telegramChatId,
            userId
          );
          
          if (isMember) {
            communityChatIds.push(community.telegramChatId);
            syncedCount++;
            this.logger.log(`User ${userId} is a member of community ${community.name}`);
          }
        } catch (error) {
          this.logger.warn(`Error checking membership for community ${community.telegramChatId}:`, error.message);
          // Continue with other communities
        }
      }

      this.logger.log(`Synced ${syncedCount} communities for user ${userId}`);
      return {
        success: true,
        message: 'Communities synced successfully',
        syncedCount: syncedCount,
        membershipsUpdated: syncedCount,
      };
    } catch (error) {
      this.logger.error(`Error syncing communities for user ${userId}:`, error);
      return {
        success: false,
        message: 'Error syncing communities',
        syncedCount: 0,
        membershipsUpdated: 0,
      };
    }
  }

  @Get(':id/publications')
  async getCommunityPublications(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    
    const publications = await this.publicationService.getPublicationsByCommunity(
      id,
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

}
