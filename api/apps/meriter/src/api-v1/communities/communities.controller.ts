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
  ForbiddenException,
} from '@nestjs/common';
import { CommunityService } from '../../domain/services/community.service';
import { PublicationService } from '../../domain/services/publication.service';
import { UserService } from '../../domain/services/user.service';
import { CommunityFeedService } from '../../domain/services/community-feed.service';
import { WalletService } from '../../domain/services/wallet.service';
import { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import { UserGuard } from '../../user.guard';
import { User } from '../../decorators/user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../common/exceptions/api.exceptions';
import { CommunitySetupHelpers } from '../common/helpers/community-setup.helpers';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import {
  Community,
  UpdateCommunityDto,
  UpdateCommunityDtoSchema,
  CreateCommunityDtoSchema,
} from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import {
  formatDualLinks,
  escapeMarkdownV2,
} from '../../common/helpers/telegram';
import { BOT_USERNAME, URL as WEB_BASE_URL } from '../../config';
import { t } from '../../i18n';

@Controller('api/v1/communities')
@UseGuards(UserGuard)
export class CommunitiesController {
  private readonly logger = new Logger(CommunitiesController.name);

  constructor(
    private readonly communityService: CommunityService,
    private readonly publicationService: PublicationService,
    private readonly userService: UserService,
    private readonly communityFeedService: CommunityFeedService,
    private readonly walletService: WalletService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
  ) {}

  /**
   * Helper to safely convert hashtagDescriptions from MongoDB Map to plain object.
   * When using .lean(), Mongoose returns a plain object instead of a Map.
   */
  private convertHashtagDescriptions(
    descriptions: any,
  ): Record<string, string> | undefined {
    if (!descriptions) return undefined;
    if (descriptions instanceof Map) {
      return Object.fromEntries(descriptions);
    }
    // Already a plain object from .lean()
    return descriptions as Record<string, string>;
  }

  @Get()
  async getCommunities(
    @Query() query: any,
    @User() user: AuthenticatedUser,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);

    // Superadmins can see all communities
    if (user.globalRole === 'superadmin') {
      const result = await this.communityService.getAllCommunities(
        pagination.limit,
        skip,
      );
      return {
        data: result,
        total: result.length,
        skip,
        limit: pagination.limit,
      };
    }

    // Non-superadmins (leads, participants, viewers) can only see communities where they have a role
    const userRoles = await this.userCommunityRoleService.getUserRoles(user.id);
    const userCommunityIds = userRoles.map((role) => role.communityId);

    if (userCommunityIds.length === 0) {
      // User has no roles in any community
      return {
        data: [],
        total: 0,
        skip,
        limit: pagination.limit,
      };
    }

    // Fetch communities where user has a role
    const allUserCommunities = await Promise.all(
      userCommunityIds.map((communityId) =>
        this.communityService.getCommunity(communityId),
      ),
    );

    // Filter out nulls (in case a community was deleted but role still exists)
    const validCommunities = allUserCommunities.filter(
      (community) => community !== null,
    ) as Community[];

    // Sort by priority and creation date
    validCommunities.sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    // Apply pagination
    const paginatedResult = validCommunities.slice(
      skip,
      skip + pagination.limit,
    );

    return {
      data: paginatedResult,
      total: validCommunities.length,
      skip,
      limit: pagination.limit,
    };
  }

  @Get(':id')
  async getCommunity(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<Community> {
    // Prevent "create" from being treated as an ID
    if (id === 'create') {
      throw new NotFoundError('Community', id);
    }

    const community = await this.communityService.getCommunity(id);
    if (!community) {
      throw new NotFoundError('Community', id);
    }

    // A community needs setup if it's missing essential configurations
    // Note: Having default currency name "merit" is NOT considered needing setup
    const needsSetup = CommunitySetupHelpers.calculateNeedsSetup(
      community,
      false,
    );

    this.logger.log(`Community ${id} setup check:`, {
      ...CommunitySetupHelpers.calculateSetupStatusDetails(community),
      needsSetup,
      hashtags: community.hashtags,
      currencyNames: community.settings?.currencyNames,
      dailyEmission: community.settings?.dailyEmission,
      iconUrl: community.settings?.iconUrl,
    });

    return {
      ...community,
      // Normalize adminIds from legacy fields if necessary
      adminIds: (community as any).adminIds || [],
      // Ensure settings.language is provided to match type expectations
      settings: {
        currencyNames: community.settings?.currencyNames,
        dailyEmission: community.settings?.dailyEmission as number,
        iconUrl: community.settings?.iconUrl,
        language: (community.settings as any)?.language ?? 'en',
      },
      hashtagDescriptions: this.convertHashtagDescriptions(
        community.hashtagDescriptions,
      ),
      isAdmin: await this.communityService.isUserAdmin(id, req.user.id),
      needsSetup,
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    } as any;
  }

  @Post()
  @ZodValidation(CreateCommunityDtoSchema)
  async createCommunity(
    @Body() createDto: any,
    @Req() req: any,
  ): Promise<Community> {
    // Ensure creator is added as admin
    const adminId = req.user.id;
    if (!adminId) {
      this.logger.warn(`User has no id when creating community`);
    }

    // Check if user is a viewer - viewers cannot create communities
    const userRoles = await this.userCommunityRoleService.getUserRoles(req.user.id);
    const hasViewerRole = userRoles.some(role => role.role === 'viewer');
    if (hasViewerRole) {
      throw new ForbiddenError('Viewer users cannot create communities');
    }

    // Only superadmin can set isPriority
    const isSuperadmin = req.user.globalRole === 'superadmin';
    if (createDto.isPriority && !isSuperadmin) {
      throw new ForbiddenError('Only superadmin can set community priority');
    }

    const communityDtoWithAdmin = {
      ...createDto,
      adminIds: [adminId].filter(Boolean),
      // Remove isPriority if user is not superadmin
      ...(isSuperadmin ? { isPriority: createDto.isPriority } : {}),
    };

    const community = await this.communityService.createCommunity(
      communityDtoWithAdmin,
    );

    // Add creator as member and update memberships
    await this.communityService.addMember(community.id, req.user.id);
    await this.userService.addCommunityMembership(req.user.id, community.id);

    // Set creator as lead
    await this.userCommunityRoleService.setRole(
      req.user.id,
      community.id,
      'lead',
    );

    // Create wallet for the creator
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    await this.walletService.createOrGetWallet(
      req.user.id,
      community.id,
      currency,
    );

    // A community needs setup if it's missing essential configurations
    // Note: Having default currency name "merit" is NOT considered needing setup
    const needsSetup = CommunitySetupHelpers.calculateNeedsSetup(
      community,
      false,
    );

    return {
      ...community,
      avatarUrl: community.avatarUrl,
      adminIds:
        (community as any).adminIds ||
        (community as any).adminAuthIds ||
        (community as any).adminsTG ||
        (community as any).administratorsTg ||
        (community as any).administrators ||
        [],
      settings: {
        currencyNames: community.settings?.currencyNames,
        dailyEmission: community.settings?.dailyEmission as number,
        iconUrl: community.settings?.iconUrl,
        language: (community.settings as any)?.language ?? 'en',
      },
      hashtagDescriptions: this.convertHashtagDescriptions(
        community.hashtagDescriptions,
      ),
      isAdmin: true, // Creator is admin
      needsSetup,
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    } as any;
  }

  @Put(':id')
  @ZodValidation(UpdateCommunityDtoSchema)
  async updateCommunity(
    @Param('id') id: string,
    @Body() updateDto: UpdateCommunityDto,
    @Req() req: any,
  ): Promise<Community> {
    const isAdmin = await this.communityService.isUserAdmin(id, req.user.id);
    const isSuperadmin = req.user.globalRole === 'superadmin';

    if (!isAdmin && !isSuperadmin) {
      throw new ForbiddenError(
        'Only administrators can update community settings',
      );
    }

    // Only superadmin can set isPriority
    if (updateDto.isPriority !== undefined && !isSuperadmin) {
      throw new ForbiddenError('Only superadmin can set community priority');
    }

    const community = await this.communityService.updateCommunity(
      id,
      updateDto,
    );

    // A community needs setup if it's missing essential configurations
    // Note: Having default currency name "merit" is NOT considered needing setup
    const needsSetup = CommunitySetupHelpers.calculateNeedsSetup(
      community,
      false,
    );

    this.logger.log(`Community ${id} setup check after update:`, {
      ...CommunitySetupHelpers.calculateSetupStatusDetails(community),
      needsSetup,
      hashtags: community.hashtags,
      currencyNames: community.settings?.currencyNames,
      dailyEmission: community.settings?.dailyEmission,
      iconUrl: community.settings?.iconUrl,
    });

    return {
      ...community,
      avatarUrl: community.avatarUrl,
      adminIds:
        (community as any).adminIds ||
        (community as any).adminAuthIds ||
        (community as any).adminsTG ||
        (community as any).administratorsTg ||
        (community as any).administrators ||
        [],
      settings: {
        currencyNames: community.settings?.currencyNames,
        dailyEmission: community.settings?.dailyEmission as number,
        iconUrl: community.settings?.iconUrl,
        language: (community.settings as any)?.language ?? 'en',
      },
      hashtagDescriptions: this.convertHashtagDescriptions(
        community.hashtagDescriptions,
      ),
      isAdmin: await this.communityService.isUserAdmin(id, req.user.id),
      needsSetup,
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    } as any;
  }

  @Delete(':id')
  async deleteCommunity(@Param('id') id: string, @Req() req: any) {
    const isAdmin = await this.communityService.isUserAdmin(id, req.user.id);
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can delete communities');
    }

    await this.communityService.deleteCommunity(id);
    return ApiResponseHelper.successMessage('Community deleted successfully');
  }

  @Post(':id/reset-quota')
  async resetDailyQuota(@Param('id') id: string, @Req() req: any) {
    const isAdmin = await this.communityService.isUserAdmin(id, req.user.id);
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can reset daily quota');
    }

    const { resetAt } = await this.communityService.resetDailyQuota(id);
    return ApiResponseHelper.successResponse({
      resetAt: resetAt.toISOString(),
    });
  }

  @Post(':id/send-memo')
  async sendCommunityMemo(@Param('id') id: string, @Req() req: any) {
    const isAdmin = await this.communityService.isUserAdmin(id, req.user.id);
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can send memo');
    }

    const community = await this.communityService.getCommunity(id);
    if (!community) {
      throw new NotFoundError('Community', id);
    }

    const lang = ((community.settings as any)?.language as 'en' | 'ru') || 'en';

    const dualLinksCommunity = formatDualLinks(
      'community',
      { id },
      BOT_USERNAME,
      WEB_BASE_URL,
    );
    const hashtagsRaw = (community.hashtags || [])
      .map((h) => `#${h}`)
      .join(' ');
    const hashtagsEscaped = escapeMarkdownV2(hashtagsRaw);

    // Telegram notifications are disabled in this project; skip sending welcome message.
    this.logger.log(`Telegram welcome message disabled for community ${id}`);

    return ApiResponseHelper.successResponse({ sent: false });
  }

  @Get(':id/members')
  async getCommunityMembers(@Param('id') id: string, @Query() query: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const result = await this.communityService.getCommunityMembers(
      id,
      pagination.limit,
      skip,
    );
    return PaginationHelper.createResult(
      result.members,
      result.total,
      pagination,
    );
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const isAdmin = await this.communityService.isUserAdmin(id, req.user.id);
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can remove members');
    }

    // Remove from community
    await this.communityService.removeMember(id, userId);

    // Remove from user memberships
    await this.userService.removeCommunityMembership(userId, id);

    return ApiResponseHelper.successMessage('Member removed successfully');
  }

  @Post('fake-community')
  async createFakeCommunity(@User() user: AuthenticatedUser) {
    // Check if fake data mode is enabled
    if (process.env.FAKE_DATA_MODE !== 'true') {
      throw new ForbiddenException('Fake data mode is not enabled');
    }

    this.logger.log(`Creating fake community for user: ${user.id}`);

    // Create a test community
    const testCommunity = await this.communityService.createCommunity({
      name: `Test Community ${Date.now()}`,
      description: 'Test community for fake data',
      adminIds: [user.id],
    });

    this.logger.log(`Created fake community: ${testCommunity.id}`);

    // Add user to the community
    // 1. Add user to community's members list
    await this.communityService.addMember(testCommunity.id, user.id);

    // 2. Add community to user's memberships
    if (!user.authId) {
      throw new Error('User authId is required');
    }
    await this.userService.addCommunityMembership(user.id, testCommunity.id);

    // 3. Add community to user's memberships (skip legacy communityTags update)
    // Legacy: communityTags was used for Telegram chat IDs - REMOVED

    this.logger.log(
      `Added user ${user.id} to fake community ${testCommunity.id}`,
    );

    // 4. Create wallet for the user in this community
    // This ensures the wallet is immediately available and prevents 404 errors
    const currency = testCommunity.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    await this.walletService.createOrGetWallet(
      user.id,
      testCommunity.id,
      currency,
    );
    this.logger.log(
      `Created wallet for user ${user.id} in fake community ${testCommunity.id}`,
    );

    return {
      success: true,
      data: {
        ...testCommunity,
        adminIds: (testCommunity as any).adminIds || [],
        isAdmin: true,
      },
    };
  }

  @Post('add-user-to-all')
  async addUserToAllCommunities(@User() user: AuthenticatedUser) {
    // Check if fake data mode is enabled
    if (process.env.FAKE_DATA_MODE !== 'true') {
      throw new ForbiddenException('Fake data mode is not enabled');
    }

    if (!user.authId) {
      throw new Error('User authId is required');
    }

    this.logger.log(`Adding user ${user.id} to all communities`);

    // Get all communities
    const allCommunities = await this.communityService.getAllCommunities(
      1000,
      0,
    );
    this.logger.log(
      `Found ${allCommunities.length} communities to add user to`,
    );

    let addedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const community of allCommunities) {
      try {
        // Check if user is already a member
        const userDoc = await this.userService.getUserByAuthId(
          user.authProvider,
          user.authId,
        );
        if (userDoc) {
          const currentTags = userDoc.communityTags || [];
          const currentMemberships = userDoc.communityMemberships || [];

          // Check if already a member
          const isAlreadyMember = currentMemberships.includes(community.id);

          if (isAlreadyMember) {
            skippedCount++;
            continue;
          }

          // 1. Add user to community's members list
          await this.communityService.addMember(community.id, user.id);

          // 2. Add community to user's memberships
          await this.userService.addCommunityMembership(user.id, community.id);

          // 3. Add community to user's memberships (skip legacy communityTags update)
          // Legacy: communityTags was used for Telegram chat IDs - REMOVED

          // 4. Create wallet for the user in this community
          const currency = community.settings?.currencyNames || {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          };
          await this.walletService.createOrGetWallet(
            user.id,
            community.id,
            currency,
          );

          addedCount++;
          this.logger.log(
            `Added user ${user.id} to community ${community.name} (${community.id})`,
          );
        }
      } catch (error) {
        const errorMsg = `Failed to add user to community ${community.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    this.logger.log(
      `Added user to ${addedCount} communities, skipped ${skippedCount}, errors: ${errors.length}`,
    );

    return {
      success: true,
      data: {
        added: addedCount,
        skipped: skippedCount,
        total: allCommunities.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  }

  @Post('sync')
  async syncCommunities(@Req() req: any) {
    const userId = req.user.id;
    const authId = req.user.authId;
    this.logger.log(`Syncing communities for user: ${userId}`);

    try {
      // Get all active communities
      const allCommunities = await this.communityService.getAllCommunities(
        1000,
        0,
      );
      this.logger.log(`Found ${allCommunities.length} active communities`);

      const communityChatIds: string[] = [];
      let syncedCount = 0;
      let membershipsAdded = 0;

      // Check membership for each community (only active communities)
      for (const community of allCommunities) {
        // Skip inactive communities
        if (!community.isActive) {
          this.logger.log(`Skipping inactive community: ${community.name}`);
          continue;
        }

        // Telegram membership checks are disabled
      }

      this.logger.log(
        `Synced ${syncedCount} communities for user ${userId}, added ${membershipsAdded} memberships`,
      );
      return {
        success: true,
        data: {
          message: 'Communities synced successfully',
          syncedCount: syncedCount,
          membershipsUpdated: membershipsAdded,
        },
      };
    } catch (error) {
      this.logger.error(`Error syncing communities for user ${userId}:`, error);
      return {
        success: false,
        data: {
          message: 'Error syncing communities',
          syncedCount: 0,
          membershipsUpdated: 0,
        },
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

    const publications =
      await this.publicationService.getPublicationsByCommunity(
        id,
        pagination.limit,
        skip,
      );

    // Extract unique user IDs (authors and beneficiaries)
    const userIds = new Set<string>();
    publications.forEach((pub) => {
      userIds.add(pub.getAuthorId.getValue());
      if (pub.getBeneficiaryId) {
        userIds.add(pub.getBeneficiaryId.getValue());
      }
    });

    // Batch fetch all users
    const usersMap = new Map<string, any>();
    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const user = await this.userService.getUser(userId);
        if (user) {
          usersMap.set(userId, user);
        }
      }),
    );

    // Convert domain entities to DTOs with enriched user metadata
    const mappedPublications = publications.map((publication) => {
      const authorId = publication.getAuthorId.getValue();
      const beneficiaryId = publication.getBeneficiaryId?.getValue();
      const author = usersMap.get(authorId);
      const beneficiary = beneficiaryId ? usersMap.get(beneficiaryId) : null;

      return {
        id: publication.getId.getValue(),
        communityId: publication.getCommunityId.getValue(),
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
            name: author?.displayName || author?.firstName || 'Unknown',
            photoUrl: author?.avatarUrl,
            username: author?.username,
          },
          ...(beneficiary && {
            beneficiary: {
              name:
                beneficiary.displayName || beneficiary.firstName || 'Unknown',
              photoUrl: beneficiary.avatarUrl,
              username: beneficiary.username,
            },
          }),
        },
        createdAt: publication.toSnapshot().createdAt.toISOString(),
        updatedAt: publication.toSnapshot().updatedAt.toISOString(),
      };
    });

    return PaginationHelper.createResult(
      mappedPublications,
      mappedPublications.length,
      pagination,
    );
  }

  @Get(':id/feed')
  async getCommunityFeed(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const sort = query.sort === 'recent' ? 'recent' : 'score';
    const tag = query.tag;

    const result = await this.communityFeedService.getCommunityFeed(id, {
      page: pagination.page,
      pageSize: pagination.limit,
      sort,
      tag,
    });

    return {
      success: true,
      data: result.data,
      meta: {
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.pageSize,
          total: result.pagination.total,
          hasNext: result.pagination.hasMore,
          hasPrev: result.pagination.page > 1,
        },
      },
    };
  }
}
