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
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Community, Space, UpdateCommunityDto, UpdateSpaceDto } from '../types/domain.types';

@Controller('api/v1/communities')
@UseGuards(UserGuard)
export class CommunitiesController {
  private readonly logger = new Logger(CommunitiesController.name);

  constructor(
    private readonly communityService: CommunityServiceV2,
    private readonly publicationService: PublicationServiceV2,
  ) {}

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
      isAdmin: await this.communityService.isUserAdmin(id, req.user.tgUserId),
      needsSetup: !community.hashtags || community.hashtags.length === 0,
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    };
  }

  @Post()
  async createCommunity(@Body() createDto: any, @Req() req: any): Promise<Community> {
    const community = await this.communityService.createCommunity(createDto);
    return {
      ...community,
      isAdmin: true, // Creator is admin
      needsSetup: !community.hashtags || community.hashtags.length === 0,
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
      isAdmin: await this.communityService.isUserAdmin(id, req.user.tgUserId),
      needsSetup: !community.hashtags || community.hashtags.length === 0,
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

  // TODO: Implement syncUserCommunities in CommunityServiceV2
  // @Post('sync')
  // async syncCommunities(@Req() req: any) {
  //   const result = await this.communityService.syncUserCommunities(req.user.tgUserId);
  //   return {
  //     data: {
  //       message: 'Communities synced successfully',
  //       syncedCount: result.syncedCount,
  //     },
  //     meta: {
  //       timestamp: new Date().toISOString(),
  //       requestId: req.headers['x-request-id'] || 'unknown',
  //     },
  //   };
  // }

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
      spaceId: undefined, // Not available in current entity
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
