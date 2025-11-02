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
import { CommunityService } from '../../domain/services/community.service';
import { PublicationService } from '../../domain/services/publication.service';
import { UserService } from '../../domain/services/user.service';
import { CommunityFeedService } from '../../domain/services/community-feed.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Community, UpdateCommunityDto, UpdateCommunityDtoSchema, CreateCommunityDtoSchema } from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { formatDualLinks, escapeMarkdownV2 } from '../../common/helpers/telegram';
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
    
    // A community needs setup if it's missing essential configurations
    // Note: Having default currency name "merit" is NOT considered needing setup
    const hasNoHashtags = !community.hashtags || community.hashtags.length === 0;
    const hasNoSingular = !community.settings?.currencyNames?.singular;
    const hasNoPlural = !community.settings?.currencyNames?.plural;
    const hasNoGenitive = !community.settings?.currencyNames?.genitive;
    const hasNoDailyEmission = typeof community.settings?.dailyEmission !== 'number' || 
                                community.settings?.dailyEmission == null;
    
    const needsSetup = hasNoHashtags || hasNoSingular || hasNoPlural || hasNoGenitive || hasNoDailyEmission;
    
    this.logger.log(`Community ${id} setup check:`, {
      hasNoHashtags,
      hasNoSingular,
      hasNoPlural,
      hasNoGenitive,
      hasNoDailyEmission,
      needsSetup,
      hashtags: community.hashtags,
      currencyNames: community.settings?.currencyNames,
      dailyEmission: community.settings?.dailyEmission,
      iconUrl: community.settings?.iconUrl
    });
    
    return {
      ...community,
      // Normalize adminsTG from legacy fields if necessary
      adminsTG: (community as any).adminsTG || (community as any).administratorsTg || (community as any).administrators || [],
      // Ensure settings.language is provided to match type expectations
      settings: {
        currencyNames: community.settings?.currencyNames,
        dailyEmission: community.settings?.dailyEmission as number,
        iconUrl: community.settings?.iconUrl,
        language: (community.settings as any)?.language ?? 'en',
      },
      hashtagDescriptions: this.convertHashtagDescriptions(community.hashtagDescriptions),
      isAdmin: await this.communityService.isUserAdmin(id, req.user.id),
      needsSetup,
      createdAt: community.createdAt.toISOString(),
      updatedAt: community.updatedAt.toISOString(),
    } as any;
  }

  @Post()
  @ZodValidation(CreateCommunityDtoSchema)
  async createCommunity(@Body() createDto: any, @Req() req: any): Promise<Community> {
    const community = await this.communityService.createCommunity(createDto);
    
    // A community needs setup if it's missing essential configurations
    // Note: Having default currency name "merit" is NOT considered needing setup
    const hasNoHashtags = !community.hashtags || community.hashtags.length === 0;
    const hasNoSingular = !community.settings?.currencyNames?.singular;
    const hasNoPlural = !community.settings?.currencyNames?.plural;
    const hasNoGenitive = !community.settings?.currencyNames?.genitive;
    const hasNoDailyEmission = typeof community.settings?.dailyEmission !== 'number' || 
                                community.settings?.dailyEmission == null;
    
    const needsSetup = hasNoHashtags || hasNoSingular || hasNoPlural || hasNoGenitive || hasNoDailyEmission;
    
    return {
      ...community,
      adminsTG: (community as any).adminsTG || (community as any).administratorsTg || (community as any).administrators || [],
      settings: {
        currencyNames: community.settings?.currencyNames,
        dailyEmission: community.settings?.dailyEmission as number,
        iconUrl: community.settings?.iconUrl,
        language: (community.settings as any)?.language ?? 'en',
      },
      hashtagDescriptions: this.convertHashtagDescriptions(community.hashtagDescriptions),
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
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can update community settings');
    }

    const community = await this.communityService.updateCommunity(id, updateDto);
    
    // A community needs setup if it's missing essential configurations
    // Note: Having default currency name "merit" is NOT considered needing setup
    const hasNoHashtags = !community.hashtags || community.hashtags.length === 0;
    const hasNoSingular = !community.settings?.currencyNames?.singular;
    const hasNoPlural = !community.settings?.currencyNames?.plural;
    const hasNoGenitive = !community.settings?.currencyNames?.genitive;
    const hasNoDailyEmission = typeof community.settings?.dailyEmission !== 'number' || 
                                community.settings?.dailyEmission == null;
    
    const needsSetup = hasNoHashtags || hasNoSingular || hasNoPlural || hasNoGenitive || hasNoDailyEmission;
    
    this.logger.log(`Community ${id} setup check after update:`, {
      hasNoHashtags,
      hasNoSingular,
      hasNoPlural,
      hasNoGenitive,
      hasNoDailyEmission,
      needsSetup,
      hashtags: community.hashtags,
      currencyNames: community.settings?.currencyNames,
      dailyEmission: community.settings?.dailyEmission,
      iconUrl: community.settings?.iconUrl
    });
    
    return {
      ...community,
      adminsTG: (community as any).adminsTG || (community as any).administratorsTg || (community as any).administrators || [],
      settings: {
        currencyNames: community.settings?.currencyNames,
        dailyEmission: community.settings?.dailyEmission as number,
        iconUrl: community.settings?.iconUrl,
        language: (community.settings as any)?.language ?? 'en',
      },
      hashtagDescriptions: this.convertHashtagDescriptions(community.hashtagDescriptions),
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
    return { success: true, data: { message: 'Community deleted successfully' } };
  }

  @Post(':id/reset-quota')
  async resetDailyQuota(@Param('id') id: string, @Req() req: any) {
    const isAdmin = await this.communityService.isUserAdmin(id, req.user.id);
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can reset daily quota');
    }

    const { resetAt } = await this.communityService.resetDailyQuota(id);
    return { success: true, data: { resetAt: resetAt.toISOString() } };
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

    const tgChatId = String((community as any).telegramChatId || '');
    if (!tgChatId) {
      throw new ValidationError('Community has no telegram chat id');
    }

    const lang = ((community.settings as any)?.language as 'en' | 'ru') || 'en';

    const dualLinksCommunity = formatDualLinks('community', { id }, BOT_USERNAME, WEB_BASE_URL);
    const hashtagsRaw = (community.hashtags || []).map((h) => `#${h}`).join(' ');
    const hashtagsEscaped = escapeMarkdownV2(hashtagsRaw);

    // Escape MarkdownV2 for template content, but preserve the dual links
    const LINK_TOKEN = '__DUAL_LINKS__';
    const templated = t('community.welcome', lang, { dualLinksCommunity: LINK_TOKEN, hashtags: hashtagsEscaped });
    const escaped = escapeMarkdownV2(templated);
    const text = escaped.replace(escapeMarkdownV2(LINK_TOKEN), dualLinksCommunity);

    await this.tgBotsService.tgSend({ tgChatId, text });

    return { success: true, data: { sent: true } };
  }

  // TODO: Implement getCommunityMembers in CommunityService
  // @Get(':id/members')
  // async getCommunityMembers(@Param('id') id: string, @Query() query: any) {
  //   const pagination = PaginationHelper.parseOptions(query);
  //   const result = await this.communityService.getCommunityMembers(id, pagination);
  //   return result;
  // }

  @Post('sync')
  async syncCommunities(@Req() req: any) {
    const userId = req.user.id;
    const telegramId = req.user.telegramId;
    this.logger.log(`Syncing communities for user: ${userId}`);
    
    try {
      // Get all active communities
      const allCommunities = await this.communityService.getAllCommunities(1000, 0);
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
        
        try {
          const isMember = await this.tgBotsService.tgGetChatMember(
            community.telegramChatId,
            telegramId
          );
          
          if (isMember) {
            communityChatIds.push(community.telegramChatId);
            syncedCount++;
            this.logger.log(`User ${userId} is a member of community ${community.name}`);
            
            // Update communityTags (used by wallets to find communities)
            try {
              await this.tgBotsService.updateUserChatMembership(community.telegramChatId, telegramId);
            } catch (tagError) {
              this.logger.warn(
                `Error updating community tag for community ${community.telegramChatId} to user ${userId}:`,
                tagError.message
              );
            }
            
            // Add community membership to user's communityMemberships array (used by getUserCommunities)
            try {
              await this.userService.addCommunityMembership(telegramId, community.id);
              membershipsAdded++;
              this.logger.log(`Added community ${community.id} to user ${userId} memberships`);
            } catch (membershipError) {
              // Log but continue - membership might already exist or there might be a transient error
              this.logger.warn(
                `Error adding membership for community ${community.id} to user ${userId}:`,
                membershipError.message
              );
            }
          }
        } catch (error) {
          this.logger.warn(`Error checking membership for community ${community.telegramChatId}:`, error.message);
          // Continue with other communities
        }
      }

      this.logger.log(`Synced ${syncedCount} communities for user ${userId}, added ${membershipsAdded} memberships`);
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
    
    const publications = await this.publicationService.getPublicationsByCommunity(
      id,
      pagination.limit,
      skip
    );

    // Extract unique user IDs (authors and beneficiaries)
    const userIds = new Set<string>();
    publications.forEach(pub => {
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
      })
    );

    // Convert domain entities to DTOs with enriched user metadata
    const mappedPublications = publications.map(publication => {
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
              name: beneficiary.displayName || beneficiary.firstName || 'Unknown',
              photoUrl: beneficiary.avatarUrl,
              username: beneficiary.username,
            },
          }),
        },
        createdAt: publication.toSnapshot().createdAt.toISOString(),
        updatedAt: publication.toSnapshot().updatedAt.toISOString(),
      };
    });

    return PaginationHelper.createResult(mappedPublications, mappedPublications.length, pagination);
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
