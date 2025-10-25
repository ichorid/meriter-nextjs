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
import { CommunitiesService } from './communities.service';
import { PublicationsService } from '../publications/publications.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Community, Space, UpdateCommunityDto, UpdateSpaceDto } from '../types/domain.types';

@Controller('api/v1/communities')
@UseGuards(UserGuard)
export class CommunitiesController {
  private readonly logger = new Logger(CommunitiesController.name);

  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly publicationsService: PublicationsService,
  ) {}

  @Get()
  async getCommunities(@Query() query: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.communitiesService.getCommunities(pagination);
    return result;
  }

  @Get(':id')
  async getCommunity(@Param('id') id: string, @Req() req: any): Promise<Community> {
    const community = await this.communitiesService.getCommunity(id, req.user.tgUserId);
    if (!community) {
      throw new NotFoundError('Community', id);
    }
    return community;
  }

  @Post()
  async createCommunity(@Body() createDto: any, @Req() req: any): Promise<Community> {
    return this.communitiesService.createCommunity(createDto, req.user.tgUserId);
  }

  @Put(':id')
  async updateCommunity(
    @Param('id') id: string,
    @Body() updateDto: UpdateCommunityDto,
    @Req() req: any,
  ): Promise<Community> {
    const isAdmin = await this.communitiesService.isUserAdmin(id, req.user.tgUserId);
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can update community settings');
    }

    return this.communitiesService.updateCommunity(id, updateDto);
  }

  @Delete(':id')
  async deleteCommunity(@Param('id') id: string, @Req() req: any) {
    const isAdmin = await this.communitiesService.isUserAdmin(id, req.user.tgUserId);
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can delete communities');
    }

    await this.communitiesService.deleteCommunity(id);
    return { success: true, data: { message: 'Community deleted successfully' } };
  }

  @Get(':id/members')
  async getCommunityMembers(@Param('id') id: string, @Query() query: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.communitiesService.getCommunityMembers(id, pagination);
    return result;
  }

  @Post('sync')
  async syncCommunities(@Req() req: any) {
    const result = await this.communitiesService.syncUserCommunities(req.user.tgUserId);
    return {
      data: {
        message: 'Communities synced successfully',
        syncedCount: result.syncedCount,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }

  @Get(':id/publications')
  async getCommunityPublications(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const sortOptions = {
      sort: query.sort || 'score',
      order: query.order || 'desc',
    };
    const result = await this.publicationsService.getCommunityPublications(
      id,
      pagination,
      req.user.tgUserId,
    );
    return result;
  }

}
