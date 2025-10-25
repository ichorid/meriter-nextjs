import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PublicationsService } from '../publications/publications.service';
import { UserGuard } from '../../user.guard';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { User } from '../types/domain.types';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Controller('api/v1/users')
@UseGuards(UserGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly publicationsService: PublicationsService,
  ) {}

  @Get(':userId')
  async getUser(@Param('userId') userId: string): Promise<User> {
    const user = await this.usersService.getUser(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return user;
  }

  @Get(':userId/profile')
  async getUserProfile(@Param('userId') userId: string): Promise<User> {
    const user = await this.usersService.getUser(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return user;
  }

  @Get(':userId/communities')
  async getUserCommunities(@Param('userId') userId: string, @Req() req: any) {
    // Users can only see their own communities
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    return this.usersService.getUserCommunities(userId);
  }

  @Get(':userId/updates-frequency')
  async getUpdatesFrequency(@Param('userId') userId: string, @Req() req: any) {
    // Users can only see their own settings
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    return this.usersService.getUpdatesFrequency(userId);
  }

  @Put(':userId/updates-frequency')
  async updateUpdatesFrequency(
    @Param('userId') userId: string,
    @Body() body: { frequency: string },
    @Req() req: any,
  ) {
    // Users can only update their own settings
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    return this.usersService.updateUpdatesFrequency(userId, body.frequency);
  }

  @Get(':userId/publications')
  async getUserPublications(
    @Param('userId') userId: string,
    @Query() query: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.publicationsService.getUserPublications(userId, pagination);
    return result;
  }

}
