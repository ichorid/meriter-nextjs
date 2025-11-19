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
import { PollService } from '../../domain/services/poll.service';
import { PollCastService } from '../../domain/services/poll-cast.service';
import { WalletService } from '../../domain/services/wallet.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserService } from '../../domain/services/user.service';
import { UserEnrichmentService } from '../common/services/user-enrichment.service';
import { CommunityEnrichmentService } from '../common/services/community-enrichment.service';
import { EntityMappers } from '../common/mappers/entity-mappers';
import { Wallet } from '../../domain/aggregates/wallet/wallet.entity';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Poll, CreatePollDto, CreatePollDtoSchema, CreatePollCastDto, CreatePollCastDtoSchema, UpdatePollDtoSchema } from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { formatDualLinks, escapeMarkdownV2 } from '../../common/helpers/telegram';
import { BOT_USERNAME, URL as WEB_BASE_URL } from '../../config';
import { t } from '../../i18n';

@Controller('api/v1/polls')
@UseGuards(UserGuard)
export class PollsController {
  private readonly logger = new Logger(PollsController.name);

  constructor(
    private readonly pollsService: PollService,
    private readonly pollCastService: PollCastService,
    private readonly walletService: WalletService,
    private readonly communityService: CommunityService,
    private readonly userService: UserService,
    private readonly userEnrichmentService: UserEnrichmentService,
    private readonly communityEnrichmentService: CommunityEnrichmentService,
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
      
    return ApiResponseHelper.successResponse({ data: apiPolls, total: apiPolls.length, skip, limit: pagination.limit });
    }
    
    // Default behavior: return empty array for now
    return ApiResponseHelper.successResponse({ data: [], total: 0, skip: 0, limit: pagination.limit });
  }

  @Get(':id')
  async getPoll(@Param('id') id: string, @Req() req: any) {
    const poll = await this.pollsService.getPoll(id);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }
    const snapshot = poll.toSnapshot();
    
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
    };
    
    return ApiResponseHelper.successResponse(apiPoll);
  }

  @Post()
  @ZodValidation(CreatePollDtoSchema)
  async createPoll(
    @Body() createDto: CreatePollDto,
    @Req() req: any,
  ) {
    // Transform API CreatePollDto to domain CreatePollDto
    const domainDto = {
      ...createDto,
      expiresAt: new Date(createDto.expiresAt),
    } as any;
    
    const poll = await this.pollsService.createPoll(req.user.id, domainDto);
    const snapshot = poll.toSnapshot();
    
    // Batch fetch user and community using enrichment services
    const [usersMap, communitiesMap] = await Promise.all([
      this.userEnrichmentService.batchFetchUsers([snapshot.authorId]),
      this.communityEnrichmentService.batchFetchCommunities([snapshot.communityId]),
    ]);
    
    // Transform domain Poll to API Poll format
    const apiPoll = EntityMappers.mapPollToApi(poll, usersMap, communitiesMap);
    
    // Telegram notifications are disabled in this project; skip sending poll notifications.
    this.logger.log(`Poll ${snapshot.id} created; Telegram notifications are disabled, skipping community chat notification`);
    
    return ApiResponseHelper.successResponse(apiPoll);
  }

  @Put(':id')
  @ZodValidation(UpdatePollDtoSchema)
  async updatePoll(
    @Param('id') id: string,
    @Body() updateDto: any,
    @Req() req: any,
  ): Promise<Poll> {
    // Update functionality not implemented yet
    throw new Error('Update poll functionality not implemented');
  }

  @Delete(':id')
  async deletePoll(@Param('id') id: string, @Req() req: any) {
    const poll = await this.pollsService.getPoll(id);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }

    if (poll.toSnapshot().authorId !== req.user.id) {
      throw new ForbiddenError('Only the author can delete this poll');
    }

    // Delete functionality not implemented yet
    throw new Error('Delete poll functionality not implemented');
  }

  @Post(':id/casts')
  @ZodValidation(CreatePollCastDtoSchema)
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
    
    // Poll casts only use wallet (quotaAmount should be 0)
    const quotaAmount = createDto.quotaAmount ?? 0;
    const walletAmount = createDto.walletAmount ?? 0;
    const totalAmount = quotaAmount + walletAmount;
    
    // Validate amounts
    if (quotaAmount > 0) {
      throw new ValidationError('Poll casts cannot use quota, only wallet');
    }
    if (walletAmount <= 0) {
      throw new ValidationError('Cast amount must be positive');
    }
    if (totalAmount <= 0) {
      throw new ValidationError('Cast amount must be positive');
    }
    
    // Get community to get currency info (needed for wallet operations)
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }
    
    // Validate and deduct balance BEFORE creating cast
    // This prevents race conditions by checking balance first
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
    const updatedWallet = await this.walletService.addTransaction(
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
    
    // Update poll aggregate to reflect the cast
    await this.pollsService.updatePollForCast(id, createDto.optionId, walletAmount, isNewCaster);
    
    // Get final wallet balance to return (already set from transaction)
    
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
    
    return { 
      success: true, 
      data: { 
        data: apiPolls, 
        total: result.length, 
        skip, 
        limit: pagination.limit 
      } 
    };
  }
}
