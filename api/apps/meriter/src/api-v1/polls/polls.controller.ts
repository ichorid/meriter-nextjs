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
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PollService } from '../../domain/services/poll.service';
import { PollCastService } from '../../domain/services/poll-cast.service';
import { WalletService } from '../../domain/services/wallet.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserService } from '../../domain/services/user.service';
import { PermissionService } from '../../domain/services/permission.service';
import { QuotaUsageService } from '../../domain/services/quota-usage.service';
import { UserEnrichmentService } from '../common/services/user-enrichment.service';
import { CommunityEnrichmentService } from '../common/services/community-enrichment.service';
import { PermissionsHelperService } from '../common/services/permissions-helper.service';
import { EntityMappers } from '../common/mappers/entity-mappers';
import { Wallet } from '../../domain/aggregates/wallet/wallet.entity';
import { UserGuard } from '../../user.guard';
import { PermissionGuard } from '../../permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Poll, CreatePollDto, CreatePollDtoSchema, CreatePollCastDto, CreatePollCastDtoSchema, UpdatePollDtoSchema } from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { formatDualLinks, escapeMarkdownV2 } from '../../common/helpers/telegram';
import { BOT_USERNAME, URL as WEB_BASE_URL } from '../../config';
import { t } from '../../i18n';

@Controller('api/v1/polls')
@UseGuards(UserGuard, PermissionGuard)
export class PollsController {
  private readonly logger = new Logger(PollsController.name);

  constructor(
    private readonly pollsService: PollService,
    private readonly pollCastService: PollCastService,
    private readonly walletService: WalletService,
    private readonly communityService: CommunityService,
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
    private readonly quotaUsageService: QuotaUsageService,
    private readonly userEnrichmentService: UserEnrichmentService,
    private readonly communityEnrichmentService: CommunityEnrichmentService,
    private readonly permissionsHelperService: PermissionsHelperService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  async getPolls(@Query() query: any, @Req() req: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    
    // If userId is provided, return polls created by user or where user has cast votes
    if (query.userId) {
      const result = await this.pollsService.getPollsByUser(
        query.userId,
        pagination.limit,
        skip
      );
      
      // Extract unique user IDs (authors) and community IDs
      const authorIds = [...new Set(result.map(poll => poll.toSnapshot().authorId))];
      const communityIds = [...new Set(result.map(poll => poll.toSnapshot().communityId))];
      
      // Batch fetch all users and communities using enrichment services
      const [usersMap, communitiesMap] = await Promise.all([
        this.userEnrichmentService.batchFetchUsers(authorIds),
        this.communityEnrichmentService.batchFetchCommunities(communityIds),
      ]);
      
      // Transform domain Polls to API format with enriched metadata
      const apiPolls = result.map(poll => EntityMappers.mapPollToApi(poll, usersMap, communitiesMap));
      
      // Batch calculate permissions for all polls
      const pollIds = apiPolls.map((poll) => poll.id);
      const permissionsMap = await Promise.all(
        pollIds.map((pollId) => 
          this.permissionsHelperService.calculatePollPermissions(req.user?.id, pollId)
        )
      );

      // Add permissions to each poll
      apiPolls.forEach((poll, index) => {
        poll.permissions = permissionsMap[index];
      });
      
    return ApiResponseHelper.successResponse({ data: apiPolls, total: apiPolls.length, skip, limit: pagination.limit || 20 });
    }
    
    // Default behavior: return empty array for now
    return ApiResponseHelper.successResponse({ data: [], total: 0, skip: 0, limit: pagination.limit || 20 });
  }

  @Get(':id')
  async getPoll(@Param('id') id: string, @Req() req: any) {
    const poll = await this.pollsService.getPoll(id);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }
    const snapshot = poll.toSnapshot();
    
    // Calculate permissions
    const permissions = await this.permissionsHelperService.calculatePollPermissions(
      req.user?.id,
      id,
    );
    
    // Transform domain Poll to API Poll format
    const apiPoll: Poll = {
      id: snapshot.id,
      authorId: snapshot.authorId,
      communityId: snapshot.communityId,
      question: snapshot.question,
      description: snapshot.description,
      options: snapshot.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes,
        amount: opt.amount || 0,
        casterCount: opt.casterCount,
      })),
      metrics: snapshot.metrics,
      expiresAt: snapshot.expiresAt.toISOString(),
      isActive: snapshot.isActive,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
      permissions,
    };
    
    return ApiResponseHelper.successResponse(apiPoll);
  }

  @Post()
  @ZodValidation(CreatePollDtoSchema as any)
  @RequirePermission('create', 'poll')
  async createPoll(
    @Body() createDto: CreatePollDto,
    @Req() req: any,
  ) {
    // Prevent poll creation in future-vision communities
    const community = await this.communityService.getCommunity(createDto.communityId);
    if (!community) {
      throw new NotFoundError('Community', createDto.communityId);
    }
    if (community.typeTag === 'future-vision') {
      throw new ValidationError('Polls are disabled in future-vision communities');
    }
    
    // Get poll cost from community settings (default to 1 if not set)
    const pollCost = community.settings?.pollCost ?? 1;
    
    // Extract payment amounts
    const quotaAmount = createDto.quotaAmount ?? 0;
    const walletAmount = createDto.walletAmount ?? 0;
    
    // Default to pollCost quota if neither is specified (backward compatibility)
    const effectiveQuotaAmount = quotaAmount === 0 && walletAmount === 0 ? pollCost : quotaAmount;
    const effectiveWalletAmount = walletAmount;
    
    // Validate payment (skip if cost is 0)
    // Note: future-vision check already done above, so we can proceed with payment validation
    if (pollCost > 0) {
      // Validate that at least one payment method is provided
      if (effectiveQuotaAmount === 0 && effectiveWalletAmount === 0) {
        throw new ValidationError(
          `You must pay with either quota or wallet merits to create a poll. The cost is ${pollCost}. At least one of quotaAmount or walletAmount must be at least ${pollCost}.`,
        );
      }

      // Check quota if using quota
      if (effectiveQuotaAmount > 0) {
        const remainingQuota = await this.getRemainingQuota(
          req.user.id,
          createDto.communityId,
          community,
        );

        if (remainingQuota < effectiveQuotaAmount) {
          throw new ValidationError(
            `Insufficient quota. Available: ${remainingQuota}, Requested: ${effectiveQuotaAmount}`,
          );
        }
      }

      // Check wallet balance if using wallet
      if (effectiveWalletAmount > 0) {
        const wallet = await this.walletService.getWallet(req.user.id, createDto.communityId);
        const walletBalance = wallet ? wallet.getBalance() : 0;

        if (walletBalance < effectiveWalletAmount) {
          throw new ValidationError(
            `Insufficient wallet balance. Available: ${walletBalance}, Requested: ${effectiveWalletAmount}`,
          );
        }
      }
    }
    
    // Transform API CreatePollDto to domain CreatePollDto
    // Service handles string->Date conversion
    const domainDto = createDto;
    
    const poll = await this.pollsService.createPoll(req.user.id, domainDto);
    const snapshot = poll.toSnapshot();
    const pollId = snapshot.id;
    
    // Process payment after successful creation (skip if cost is 0)
    // Note: future-vision check already done above, so we can proceed with payment processing
    if (pollCost > 0) {
      // Record quota usage if quota was used
      if (effectiveQuotaAmount > 0) {
        try {
          await this.quotaUsageService.consumeQuota(
            req.user.id,
            snapshot.communityId,
            effectiveQuotaAmount,
            'poll_creation',
            pollId,
          );
        } catch (error) {
          this.logger.error(
            `Failed to consume quota for poll ${pollId}:`,
            error,
          );
          // Don't fail the request if quota consumption fails - poll is already created
          // This is a best-effort quota tracking
        }
      }

      // Deduct from wallet if wallet was used
      if (effectiveWalletAmount > 0) {
        try {
          const currency = community.settings?.currencyNames || {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          };

          await this.walletService.addTransaction(
            req.user.id,
            snapshot.communityId,
            'debit',
            effectiveWalletAmount,
            'personal',
            'poll_creation',
            pollId,
            currency,
            `Payment for creating poll`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to deduct wallet balance for poll ${pollId}:`,
            error,
          );
          // Don't fail the request if wallet deduction fails - poll is already created
          // This is a best-effort payment tracking
        }
      }
    }
    
    // Batch fetch user and community using enrichment services
    const [usersMap, communitiesMap] = await Promise.all([
      this.userEnrichmentService.batchFetchUsers([snapshot.authorId]),
      this.communityEnrichmentService.batchFetchCommunities([snapshot.communityId]),
    ]);
    
    // Transform domain Poll to API Poll format
    const apiPoll = EntityMappers.mapPollToApi(poll, usersMap, communitiesMap);
    
    // Telegram notifications are disabled in this project; skip sending poll notifications.
    this.logger.log(`Poll ${pollId} created; Telegram notifications are disabled, skipping community chat notification`);
    
    return ApiResponseHelper.successResponse(apiPoll);
  }

  @Put(':id')
  @ZodValidation(UpdatePollDtoSchema as any)
  @RequirePermission('edit', 'poll')
  async updatePoll(
    @Param('id') id: string,
    @Body() updateDto: any,
    @Req() req: any,
  ): Promise<{ success: true; data: Poll; meta?: Record<string, unknown> }> {
    const poll = await this.pollsService.updatePoll(id, req.user.id, updateDto);
    const snapshot = poll.toSnapshot();
    
    // Batch fetch user and community using enrichment services
    const [usersMap, communitiesMap] = await Promise.all([
      this.userEnrichmentService.batchFetchUsers([snapshot.authorId]),
      this.communityEnrichmentService.batchFetchCommunities([snapshot.communityId]),
    ]);
    
    // Transform domain Poll to API Poll format
    const apiPoll = EntityMappers.mapPollToApi(poll, usersMap, communitiesMap);
    
    return ApiResponseHelper.successResponse(apiPoll);
  }

  @Delete(':id')
  @RequirePermission('delete', 'poll')
  async deletePoll(@Param('id') id: string, @Req() req: any) {
    const poll = await this.pollsService.getPoll(id);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }

    // Permission check is handled by PermissionGuard via @RequirePermission decorator
    // Delete functionality not implemented yet
    throw new Error('Delete poll functionality not implemented');
  }

  /**
   * Calculate remaining quota for a user in a community (including poll casts)
   */
  private async getRemainingQuota(
    userId: string,
    communityId: string,
    community: any,
  ): Promise<number> {
    // Future Vision has no quota - wallet voting only
    if (community?.typeTag === 'future-vision') {
      return 0;
    }

    if (
      !community.settings?.dailyEmission ||
      typeof community.settings.dailyEmission !== 'number'
    ) {
      return 0;
    }

    const dailyQuota = community.settings.dailyEmission;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const quotaStartTime = community.lastQuotaResetAt
      ? new Date(community.lastQuotaResetAt)
      : today;

    if (!this.connection.db) {
      throw new Error('Database connection not available');
    }

    // Aggregate quota used from votes, poll casts, and quota usage
    const [votesUsed, pollCastsUsed, quotaUsageUsed] = await Promise.all([
      this.connection.db
        .collection('votes')
        .aggregate([
          {
            $match: {
              userId,
              communityId,
              createdAt: { $gte: quotaStartTime },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amountQuota' },
            },
          },
        ])
        .toArray(),
      this.connection.db
        .collection('poll_casts')
        .aggregate([
          {
            $match: {
              userId,
              communityId,
              createdAt: { $gte: quotaStartTime },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amountQuota' },
            },
          },
        ])
        .toArray(),
      this.connection.db
        .collection('quota_usage')
        .aggregate([
          {
            $match: {
              userId,
              communityId,
              createdAt: { $gte: quotaStartTime },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amountQuota' },
            },
          },
        ])
        .toArray(),
    ]);

    const votesTotal = votesUsed.length > 0 && votesUsed[0] ? (votesUsed[0].total as number) : 0;
    const pollCastsTotal = pollCastsUsed.length > 0 && pollCastsUsed[0] ? (pollCastsUsed[0].total as number) : 0;
    const quotaUsageTotal = quotaUsageUsed.length > 0 && quotaUsageUsed[0] ? (quotaUsageUsed[0].total as number) : 0;
    const used = votesTotal + pollCastsTotal + quotaUsageTotal;
    
    return Math.max(0, dailyQuota - used);
  }

  @Post(':id/casts')
  @ZodValidation(CreatePollCastDtoSchema as any)
  async castPoll(
    @Param('id') id: string,
    @Body() createDto: CreatePollCastDto,
    @Req() req: any,
  ) {
    const poll = await this.pollsService.getPoll(id);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }
    
    const snapshot = poll.toSnapshot();
    const communityId = snapshot.communityId;
    
    // Get community first to check typeTag and get settings
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    // Prevent poll casting in future-vision communities
    if (community.typeTag === 'future-vision') {
      throw new ValidationError('Poll casting is disabled in future-vision communities');
    }
    
    const quotaAmount = createDto.quotaAmount ?? 0;
    const walletAmount = createDto.walletAmount ?? 0;
    const totalAmount = quotaAmount + walletAmount;
    
    // Validate amounts
    if (totalAmount <= 0) {
      throw new ValidationError('Cast amount must be positive');
    }
    // At least one of quotaAmount or walletAmount must be positive
    if (quotaAmount <= 0 && walletAmount <= 0) {
      throw new ValidationError('Cast amount must be positive (quota or wallet)');
    }
    
    // Check user role - only participants/leads/superadmin can use quota
    if (quotaAmount > 0) {
      const userRole = await this.permissionService.getUserRoleInCommunity(
        req.user.id,
        communityId,
      );
      
      if (!userRole || !['participant', 'lead', 'superadmin'].includes(userRole)) {
        throw new ValidationError('Only participants, leads, and superadmins can use quota for poll casts');
      }
      
      // Calculate remaining quota
      const remainingQuota = await this.getRemainingQuota(
        req.user.id,
        communityId,
        community,
      );
      
      if (quotaAmount > remainingQuota) {
        throw new ValidationError(`Insufficient quota. Available: ${remainingQuota}, requested: ${quotaAmount}`);
      }
    }
    
    // Validate and deduct balance BEFORE creating cast
    // This prevents race conditions by checking balance first
    if (walletAmount > 0) {
      const wallet = await this.walletService.getWallet(req.user.id, communityId);
      if (!wallet) {
        throw new ValidationError('Wallet not found');
      }
      
      // Check balance - throws error if insufficient
      if (!wallet.canAfford(walletAmount)) {
        throw new ValidationError('Insufficient balance to cast this amount');
      }
      
      // Deduct from wallet FIRST - this will throw if balance is insufficient
      // By doing this before creating the cast, we prevent orphaned casts
      await this.walletService.addTransaction(
        req.user.id,
        communityId,
        'debit',
        walletAmount,
        'personal',
        'poll_cast',
        id,
        community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        `Cast on poll ${id}`
      );
    }
    
    // Check if this is a new caster
    const existingCasts = await this.pollsService.getUserCasts(id, req.user.id);
    const isNewCaster = existingCasts.length === 0;
    
    // Create the cast record
    const cast = await this.pollCastService.createCast(
      id,
      req.user.id,
      createDto.optionId,
      quotaAmount,
      walletAmount,
      communityId
    );
    
    // Update poll aggregate to reflect the cast (use totalAmount)
    await this.pollsService.updatePollForCast(id, createDto.optionId, totalAmount, isNewCaster);
    
    // Get final wallet balance to return
    const updatedWallet = walletAmount > 0 
      ? await this.walletService.getWallet(req.user.id, communityId)
      : null;
    
    return {
      success: true,
      data: cast,
      walletBalance: updatedWallet?.getBalance() || 0,
    };
  }

  @Get(':id/results')
  async getPollResults(@Param('id') id: string, @Req() req: any) {
    const results = await this.pollsService.getPollResults(id);
    return ApiResponseHelper.successResponse(results);
  }

  @Get(':id/my-casts')
  async getMyPollCasts(@Param('id') id: string, @Req() req: any) {
    const casts = await this.pollsService.getUserCasts(id, req.user.id);
    return ApiResponseHelper.successResponse(casts);
  }

  @Get('communities/:communityId')
  async getCommunityPolls(
    @Param('communityId') communityId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    // Return empty array for future-vision communities
    const community = await this.communityService.getCommunity(communityId);
    if (community?.typeTag === 'future-vision') {
      return { 
        success: true, 
        data: { 
          data: [], 
          total: 0, 
          skip: 0, 
          limit: 20 
        } 
      };
    }
    
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const result = await this.pollsService.getPollsByCommunity(
      communityId,
      pagination.limit,
      skip
    );
    
    // Transform domain Polls to API Poll format
    const apiPolls: Poll[] = result.map(poll => {
      const snapshot = poll.toSnapshot();
      return {
        id: snapshot.id,
        authorId: snapshot.authorId,
        communityId: snapshot.communityId,
        question: snapshot.question,
        description: snapshot.description,
        options: snapshot.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          votes: opt.votes,
          amount: opt.amount || 0,
          casterCount: opt.casterCount,
        })),
        metrics: snapshot.metrics,
        expiresAt: snapshot.expiresAt.toISOString(),
        isActive: snapshot.isActive,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
      };
    });

    // Batch calculate permissions for all polls
    const pollIds = apiPolls.map((poll) => poll.id);
    const permissionsMap = await Promise.all(
      pollIds.map((pollId) => 
        this.permissionsHelperService.calculatePollPermissions(req.user?.id, pollId)
      )
    );

    // Add permissions to each poll
    apiPolls.forEach((poll, index) => {
      poll.permissions = permissionsMap[index];
    });
    
    return { 
      success: true, 
      data: { 
        data: apiPolls, 
        total: result.length, 
        skip, 
        limit: pagination.limit || 20 
      } 
    };
  }
}

