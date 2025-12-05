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
import { VoteService } from '../../domain/services/vote.service';
import { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserGuard } from '../../user.guard';
import { NotFoundError, ForbiddenError } from '../../common/exceptions/api.exceptions';
import {
  User,
  UpdatesFrequencySchema,
  UpdateUserProfileSchema,
} from '../../../../../../libs/shared-types/dist/index';
import { JwtService } from '../common/utils/jwt-service.util';
import { UserSettingsService } from '../../domain/services/user-settings.service';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { PaginationHelper } from '../../common/helpers/pagination.helper';

@Controller('api/v1/users')
@UseGuards(UserGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly userService: UserService,
    private readonly publicationService: PublicationService,
    private readonly voteService: VoteService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly communityService: CommunityService,
    @InjectConnection() private mongoose: Connection,
    private readonly userSettingsService: UserSettingsService,
  ) { }

  @Get('leads')
  async getAllLeads(@Query() query: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);

    // Get all unique user IDs that have lead role in at least one community
    const leadUserIds =
      await this.userCommunityRoleService.getAllUsersByRole('lead');

    // Fetch user details for all lead user IDs first to filter out deleted users
    const allUsers = await Promise.all(
      leadUserIds.map(async (userId) => {
        const user = await this.userService.getUser(userId);
        return user ? { userId, user: this.mapUserToV1Format(user) } : null;
      }),
    );

    // Filter out null values (users that might have been deleted)
    const validUserEntries = allUsers.filter((entry) => entry !== null);
    const validUserIds = validUserEntries.map((entry) => entry!.userId);
    
    // Get total count of valid users (excluding deleted)
    const total = validUserIds.length;

    // Apply pagination to valid user IDs
    const paginatedUserIds = validUserIds.slice(skip, skip + pagination.limit);
    
    // Get the corresponding user objects
    const validUsers = paginatedUserIds.map((userId) => {
      const entry = validUserEntries.find((e) => e!.userId === userId);
      return entry!.user;
    });

    // Return in the format expected by frontend (with meta.pagination)
    return {
      data: validUsers,
      meta: {
        pagination: {
          page: pagination.page || 1,
          pageSize: pagination.limit || 20,
          total: total,
          totalPages: Math.ceil(total / (pagination.limit || 20)),
          hasNext: (pagination.page || 1) * (pagination.limit || 20) < total,
          hasPrev: (pagination.page || 1) > 1,
        },
        timestamp: new Date().toISOString(),
        requestId: '',
      },
    };
  }

  @Get('search')
  async searchUsers(@Query('q') query: string, @Query('limit') limit: number) {
    if (!query || query.length < 2) {
      return [];
    }
    const users = await this.userService.searchUsers(query, limit || 20);
    return users.map((u) => this.mapUserToV1Format(u));
  }

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
    const communityIds =
      await this.userService.getUserCommunities(actualUserId);
    // TODO: Convert community IDs to full community objects using CommunityService
    return communityIds.map((id) => ({
      id,
      name: 'Community',
      description: '',
    }));
  }

  @Get(':userId/updates-frequency')
  async getUpdatesFrequency(@Param('userId') userId: string, @Req() req: any) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;

    // Users can only see their own settings
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }
    const settings = await this.userSettingsService.getOrCreate(actualUserId);
    // map legacy 'immediately' to 'immediate' for internal usage if needed
    const frequency = settings.updatesFrequency;
    return { frequency };
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
    const allowed = ['immediate', 'hourly', 'daily', 'never'];
    const frequency = body.frequency;
    if (!allowed.includes(frequency)) {
      return { frequency: 'daily' };
    }
    const updated = await this.userSettingsService.setUpdatesFrequency(
      actualUserId,
      frequency,
    );
    return { frequency: updated.updatesFrequency };
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
      skip,
    );

    // Convert domain entities to DTOs
    const mappedPublications = publications.map((publication) => ({
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

    return PaginationHelper.createResult(
      mappedPublications,
      mappedPublications.length,
      pagination,
    );
  }

  @Get(':userId/roles')
  async getUserRoles(@Param('userId') userId: string, @Req() req: any) {
    // Users can only see their own roles
    if (userId !== 'me' && userId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }

    const actualUserId = userId === 'me' ? req.user.id : userId;
    const roles =
      await this.userCommunityRoleService.getUserRoles(actualUserId);

    // Get community names for each role
    const rolesWithCommunities = await Promise.all(
      roles.map(async (role) => {
        const community = await this.communityService.getCommunity(
          role.communityId,
        );
        return {
          id: role.id,
          userId: role.userId,
          communityId: role.communityId,
          communityName: community?.name || role.communityId,
          role: role.role,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        };
      }),
    );

    return rolesWithCommunities;
  }

  @Get(':userId/projects')
  async getUserProjects(
    @Param('userId') userId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    // Users can only see their own projects
    if (userId !== 'me' && userId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }

    const actualUserId = userId === 'me' ? req.user.id : userId;
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);

    // Get publications directly from MongoDB to access isProject field
    const publicationDocs = await this.mongoose.db
      .collection('publications')
      .find({ authorId: actualUserId, isProject: true })
      .limit(pagination.limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .toArray();

    // Get total count for pagination
    const totalProjects = await this.mongoose.db
      .collection('publications')
      .countDocuments({ authorId: actualUserId, isProject: true });

    // Get community names for each project
    const projectsWithCommunities = await Promise.all(
      publicationDocs.map(async (doc: any) => {
        const communityId = doc.communityId;
        const community = await this.communityService.getCommunity(communityId);
        return {
          id: doc.id,
          communityId,
          communityName: community?.name || communityId,
          authorId: doc.authorId,
          title: doc.title,
          description: doc.description,
          postType: doc.postType,
          isProject: true,
          createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
        };
      }),
    );

    return PaginationHelper.createResult(
      projectsWithCommunities,
      totalProjects,
      pagination,
    );
  }

  @Get(':userId/lead-communities')
  async getLeadCommunities(@Param('userId') userId: string, @Req() req: any) {
    // Users can only see their own lead communities
    if (userId !== 'me' && userId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }

    const actualUserId = userId === 'me' ? req.user.id : userId;
    const communityIds =
      await this.userCommunityRoleService.getCommunitiesByRole(
        actualUserId,
        'lead',
      );

    // Get full community objects
    const communities = await Promise.all(
      communityIds.map(async (id) => {
        const community = await this.communityService.getCommunity(id);
        return community;
      }),
    );

    return communities.filter((c) => c !== null);
  }

  @Put('me/profile')
  @ZodValidation(UpdateUserProfileSchema)
  async updateMyProfile(@Body() body: any, @Req() req: any): Promise<User> {
    const userId = req.user.id;

    // Clean up null values - convert to undefined
    const profileData: any = {};
    
    // Top-level user fields
    if (body.displayName !== undefined && body.displayName !== null)
      profileData.displayName = body.displayName;
    if (body.avatarUrl !== undefined && body.avatarUrl !== null)
      profileData.avatarUrl = body.avatarUrl;
    
    // Profile sub-object fields
    if (body.bio !== undefined && body.bio !== null) profileData.bio = body.bio;
    if (body.location !== undefined && body.location !== null)
      profileData.location = body.location;
    if (body.website !== undefined && body.website !== null)
      profileData.website = body.website;
    if (body.values !== undefined && body.values !== null)
      profileData.values = body.values;
    if (body.about !== undefined && body.about !== null)
      profileData.about = body.about;
    if (body.contacts !== undefined && body.contacts !== null)
      profileData.contacts = body.contacts;
    if (body.educationalInstitution !== undefined && body.educationalInstitution !== null)
      profileData.educationalInstitution = body.educationalInstitution;
    
    // Handle nested profile object from frontend
    if (body.profile) {
      if (body.profile.bio !== undefined && body.profile.bio !== null)
        profileData.bio = body.profile.bio;
      if (body.profile.location !== undefined && body.profile.location !== null)
        profileData.location = body.profile.location;
      if (body.profile.website !== undefined && body.profile.website !== null)
        profileData.website = body.profile.website;
      if (body.profile.values !== undefined && body.profile.values !== null)
        profileData.values = body.profile.values;
      if (body.profile.about !== undefined && body.profile.about !== null)
        profileData.about = body.profile.about;
      if (body.profile.contacts !== undefined && body.profile.contacts !== null)
        profileData.contacts = body.profile.contacts;
      if (body.profile.educationalInstitution !== undefined && body.profile.educationalInstitution !== null)
        profileData.educationalInstitution = body.profile.educationalInstitution;
    }

    const updatedUser = await this.userService.updateProfile(
      userId,
      profileData,
    );
    return this.mapUserToV1Format(updatedUser);
  }

  @Get('me/merit-stats')
  async getMyMeritStats(@Req() req: any) {
    const userId = req.user.id;
    const user = await this.userService.getUser(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Get user roles to check if they are a lead in any community
    const leadCommunities =
      await this.userCommunityRoleService.getCommunitiesByRole(userId, 'lead');

    // Return merit stats only for communities where user is a lead
    const meritStats = [];
    if (user.meritStats) {
      for (const communityId of leadCommunities) {
        if (user.meritStats[communityId] !== undefined) {
          const community =
            await this.communityService.getCommunity(communityId);
          meritStats.push({
            communityId,
            communityName: community?.name || communityId,
            amount: user.meritStats[communityId],
          });
        }
      }
    }

    return {
      meritStats,
    };
  }

  @Get('leads')
  async getAllLeads(@Query() query: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);

    // Get all unique user IDs that have lead role in at least one community
    const leadUserIds =
      await this.userCommunityRoleService.getAllUsersByRole('lead');

    // Get total count
    const total = leadUserIds.length;

    // Apply pagination
    const paginatedUserIds = leadUserIds.slice(skip, skip + pagination.limit);

    // Fetch user details for paginated user IDs
    const users = await Promise.all(
      paginatedUserIds.map(async (userId) => {
        const user = await this.userService.getUser(userId);
        return user ? this.mapUserToV1Format(user) : null;
      }),
    );

    // Filter out null values (users that might have been deleted)
    const validUsers = users.filter((u) => u !== null);

    return PaginationHelper.createResult(validUsers, total, pagination);
  }

  @Get('leads')
  async getAllLeads(@Query() query: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);

    // Get all unique user IDs that have lead role in at least one community
    const leadUserIds =
      await this.userCommunityRoleService.getAllUsersByRole('lead');

    // Fetch user details for all lead user IDs first to filter out deleted users
    const allUsers = await Promise.all(
      leadUserIds.map(async (userId) => {
        const user = await this.userService.getUser(userId);
        return user ? { userId, user: this.mapUserToV1Format(user) } : null;
      }),
    );

    // Filter out null values (users that might have been deleted)
    const validUserEntries = allUsers.filter((entry) => entry !== null);
    const validUserIds = validUserEntries.map((entry) => entry!.userId);
    
    // Get total count of valid users (excluding deleted)
    const total = validUserIds.length;

    // Apply pagination to valid user IDs
    const paginatedUserIds = validUserIds.slice(skip, skip + pagination.limit);
    
    // Get the corresponding user objects
    const validUsers = paginatedUserIds.map((userId) => {
      const entry = validUserEntries.find((e) => e!.userId === userId);
      return entry!.user;
    });

    // Return in the format expected by frontend (with meta.pagination)
    return {
      data: validUsers,
      meta: {
        pagination: {
          page: pagination.page || 1,
          pageSize: pagination.limit || 20,
          total: total,
          totalPages: Math.ceil(total / (pagination.limit || 20)),
          hasNext: (pagination.page || 1) * (pagination.limit || 20) < total,
          hasPrev: (pagination.page || 1) > 1,
        },
        timestamp: new Date().toISOString(),
        requestId: '',
      },
    };
  }

  @Get('search')
  async searchUsers(@Query('q') query: string, @Query('limit') limit: number) {
    if (!query || query.length < 2) {
      return [];
    }
    const users = await this.userService.searchUsers(query, limit || 20);
    return users.map((u) => this.mapUserToV1Format(u));
  }

  @Put(':userId/global-role')
  async updateGlobalRole(
    @Param('userId') userId: string,
    @Body() body: { role: 'superadmin' | 'user' },
    @Req() req: any,
  ) {
    // Check if requester is superadmin
    const requester = await this.userService.getUser(req.user.id);
    if (requester?.globalRole !== 'superadmin') {
      throw new ForbiddenError('Only superadmins can update global roles');
    }

    const updatedUser = await this.userService.updateGlobalRole(
      userId,
      body.role,
    );
    return this.mapUserToV1Format(updatedUser);
  }

  private mapUserToV1Format(user: any): User {
    return JwtService.mapUserToV1Format(user);
  }
}
