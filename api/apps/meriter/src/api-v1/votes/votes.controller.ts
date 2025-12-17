import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { VoteService } from '../../domain/services/vote.service';
import { UserSettingsService } from '../../domain/services/user-settings.service';
import { UserUpdatesService } from '../../domain/services/user-updates.service';
import { PublicationService } from '../../domain/services/publication.service';
import { CommentService } from '../../domain/services/comment.service';
import { UserService } from '../../domain/services/user.service';
import { WalletService } from '../../domain/services/wallet.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import { UserGuard } from '../../user.guard';
import { PermissionGuard } from '../../permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/api.exceptions';
import {
  Vote,
  VoteWithCommentDto,
  VoteWithCommentDtoSchema,
  WithdrawAmountDtoSchema,
} from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../../domain/models/publication/publication.schema';
import type { Publication } from '../../domain/models/publication/publication.schema';

@Controller('api/v1')
@UseGuards(UserGuard, PermissionGuard)
export class VotesController {
  private readonly logger = new Logger(VotesController.name);

  constructor(
    private readonly voteService: VoteService,
    private readonly publicationService: PublicationService,
    private readonly commentService: CommentService,
    private readonly userService: UserService,
    private readonly walletService: WalletService,
    private readonly communityService: CommunityService,
    private readonly userSettingsService: UserSettingsService,
    private readonly userUpdatesService: UserUpdatesService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

  /**
   * Calculate remaining quota for a user in a community
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

    const [votesUsed, quotaUsageUsed] = await Promise.all([
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
    const quotaUsageTotal = quotaUsageUsed.length > 0 && quotaUsageUsed[0] ? (quotaUsageUsed[0].total as number) : 0;
    const used = votesTotal + quotaUsageTotal;
    return Math.max(0, dailyQuota - used);
  }

  /**
   * Get wallet balance for a user in a community
   */
  private async getWalletBalance(
    userId: string,
    communityId: string,
  ): Promise<number> {
    const wallet = await this.walletService.getWallet(userId, communityId);
    return wallet ? wallet.getBalance() : 0;
  }

  /**
   * Create vote with quota and/or wallet amounts
   * Creates a single vote document with both amounts
   */
  private async createVoteWithQuotaAndWallet(
    userId: string,
    targetType: 'publication' | 'vote',
    targetId: string,
    quotaAmount: number,
    walletAmount: number,
    direction: 'up' | 'down',
    communityId: string,
    community: any,
    comment: string,
    images?: string[],
  ): Promise<any> {
    // Validate that quota is not used for downvotes
    if (direction === 'down' && quotaAmount > 0) {
      throw new BadRequestException('Quota cannot be used for downvotes');
    }

    // Create single vote with both amounts and explicit direction
    const vote = await this.voteService.createVote(
      userId,
      targetType,
      targetId,
      quotaAmount,
      walletAmount,
      direction,
      comment,
      communityId,
      images,
    );

    // Deduct from wallet: only walletAmount is deducted from wallet balance
    // quotaAmount is tracked separately via the vote system and does not affect wallet balance
    if (walletAmount > 0) {
      const transactionType =
        targetType === 'publication' ? 'publication_vote' : 'vote_vote';
      await this.walletService.addTransaction(
        userId,
        communityId,
        'debit',
        walletAmount,
        'personal',
        transactionType,
        targetId,
        community.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        `Vote on ${targetType} ${targetId}${quotaAmount > 0 && walletAmount > 0 ? ` (quota: ${quotaAmount}, wallet: ${walletAmount})` : ` (wallet: ${walletAmount})`}`,
      );
    }

    return vote;
  }

  /**
   * Credit user wallet with automatic merit conversion
   * Note: Team communities have isolated meritonomy - no conversion happens
   * Note: Special groups (marathon-of-good, future-vision) skip merit awarding here
   */
  private async creditUserWithConversion(
    userId: string,
    communityId: string,
    amount: number,
    community: any,
    referenceType: string,
    referenceId: string,
    description: string,
  ): Promise<void> {
    // Check if this is a team community - if so, skip merit conversion (isolated meritonomy)
    if (community.typeTag === 'team') {
      // Team community: credit only the team community wallet, no conversion
      const currency = community.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };

      await this.walletService.addTransaction(
        userId,
        communityId,
        'credit',
        amount,
        'personal',
        referenceType,
        referenceId,
        currency,
        description,
      );
      return;
    }

    // Skip merit awarding for special groups (handled separately in awardMeritsToBeneficiary)
    // CRITICAL: For marathon-of-good, merits are credited to Future Vision wallet in awardMeritsToBeneficiary
    // This early return ensures NO credits go to marathon-of-good wallet from this method
    if (community.typeTag === 'marathon-of-good' || community.typeTag === 'future-vision') {
      return;
    }

    // For other communities, credit the original community wallet
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    await this.walletService.addTransaction(
      userId,
      communityId,
      'credit',
      amount,
      'personal',
      referenceType,
      referenceId,
      currency,
      description,
    );
  }

  /**
   * Award merits to beneficiary after voting
   * 
   * IMPORTANT: For Marathon of Good publications:
   * - Permanent merits MUST be credited ONLY to Future Vision wallet
   * - NO merits should be credited to Marathon of Good wallet
   * - NO merits should be credited to any other groups
   * 
   * Rules:
   * - Marathon of Good: awards to beneficiary's Future Vision wallet ONLY
   * - Future Vision: no merit awarding (already handled by early return)
   * - Self-votes: no merit awarding (voter cannot earn merits from voting on their own posts)
   * - Other communities: normal merit awarding
   */
  private async awardMeritsToBeneficiary(
    publication: any,
    communityId: string,
    amount: number,
    community: any,
    voterId: string,
  ): Promise<void> {
    try {
      this.logger.log(`[awardMeritsToBeneficiary] START: publicationId=${publication?.getId?.getValue()}, amount=${amount}, voterId=${voterId}`);
      const effectiveBeneficiary = publication.getEffectiveBeneficiary();
      if (!effectiveBeneficiary) {
        this.logger.warn(`[awardMeritsToBeneficiary] No effective beneficiary found for publication ${publication?.getId?.getValue()}`);
        return;
      }
      const beneficiaryId = effectiveBeneficiary.getValue();
    if (!beneficiaryId) {
      return;
    }

    // Skip merit awarding if voter is the effective beneficiary (self-vote)
    // This prevents users from earning merits by voting on their own posts
    if (voterId === beneficiaryId) {
      this.logger.log(
        `Skipping merit award: voter ${voterId} is the effective beneficiary of publication ${publication.getId.getValue()}`,
      );
      return;
    }

    // If publication is in Future Vision, skip merit awarding
    if (community.typeTag === 'future-vision') {
      return;
    }

    // If publication is in Marathon of Good, credit Future Vision wallet ONLY
    // CRITICAL: This early return ensures NO credits go to marathon-of-good or any other groups
    if (community.typeTag === 'marathon-of-good') {
      const futureVisionCommunity =
        await this.communityService.getCommunityByTypeTag('future-vision');

      if (futureVisionCommunity) {
        const fvCurrency = futureVisionCommunity.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };

        // Credit Future Vision wallet directly - this is the ONLY wallet that should receive credits
        // for marathon-of-good upvotes. NO credits should go to marathon-of-good wallet.
        await this.walletService.addTransaction(
          beneficiaryId,
          futureVisionCommunity.id, // Future Vision community ID - NOT marathon-of-good
          'credit',
          amount,
          'personal',
          'merit_transfer_gdm_to_fv',
          publication.getId.getValue(),
          fvCurrency,
          `Merits from vote on Marathon of Good publication ${publication.getId.getValue()}`,
        );

        this.logger.log(
          `Awarded ${amount} merits to beneficiary ${beneficiaryId} in Future Vision (community: ${futureVisionCommunity.id}) from Marathon of Good publication ${publication.getId.getValue()}. NO credits to marathon-of-good.`,
        );
      } else {
        this.logger.warn(
          `Future Vision community not found. Skipping merit award for Marathon of Good publication ${publication.getId.getValue()}`,
        );
      }
      // CRITICAL: Early return prevents any fall-through to creditUserWithConversion
      // This ensures NO credits go to marathon-of-good wallet
      return;
    }

      // For other communities (not marathon-of-good, not future-vision), use normal merit awarding
      // This will credit the original community wallet
      this.logger.log(`[awardMeritsToBeneficiary] Crediting user with conversion: beneficiaryId=${beneficiaryId}, amount=${amount}`);
      await this.creditUserWithConversion(
        beneficiaryId,
        communityId,
        amount,
        community,
        'publication_vote',
        publication.getId.getValue(),
        `Merits from vote on publication ${publication.getId.getValue()}`,
      );
      this.logger.log(`[awardMeritsToBeneficiary] SUCCESS: Awarded ${amount} merits to ${beneficiaryId}`);
    } catch (error) {
      this.logger.error(`[awardMeritsToBeneficiary] ERROR: ${error?.message || 'Unknown error'}`, error?.stack);
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Validate and process quotaAmount and walletAmount
   * Returns { quotaAmount, walletAmount, totalAmount, direction }
   * Direction is determined explicitly from user intent (signed amount) or inferred from amounts
   */
  private async validateAndProcessVoteAmounts(
    userId: string,
    communityId: string,
    community: any,
    createDto: VoteWithCommentDto | any,
    targetType?: 'publication' | 'vote',
  ): Promise<{
    quotaAmount: number;
    walletAmount: number;
    totalAmount: number;
    direction: 'up' | 'down';
  }> {
    const quotaAmount = createDto.quotaAmount ?? 0;
    const walletAmount = createDto.walletAmount ?? 0;
    const totalAmount = quotaAmount + walletAmount;

    // Check if community is a special group (marathon-of-good or future-vision)
    const isMarathonOfGood = community?.typeTag === 'marathon-of-good';
    const isFutureVision = community?.typeTag === 'future-vision';
    const isSpecialGroup = isMarathonOfGood || isFutureVision;

    // Determine vote direction from amounts
    // For Future Vision groups: wallet-only votes are upvotes (quota is blocked)
    let direction: 'up' | 'down' = 'up';
    if (createDto.direction) {
      direction = createDto.direction;
    } else if (isFutureVision) {
      // In Future Vision, all votes are wallet-only, so they're upvotes by default
      direction = 'up';
    } else {
      // For other groups: quotaAmount > 0 means upvote, wallet-only means downvote
      direction = quotaAmount > 0 ? 'up' : 'down';
    }

    // Validation: reject double-zero votes
    if (quotaAmount === 0 && walletAmount === 0) {
      throw new BadRequestException(
        'Cannot vote with zero quota and zero wallet amount',
      );
    }

    // Marathon of Good: Block wallet voting on publications/comments (quota only)
    // Future Vision: Block quota voting on publications/comments (wallet only)
    // Support communities: Allow both quota and wallet voting (like regular communities)
    // Polls are handled separately and always use wallet
    if (targetType && (targetType === 'publication' || targetType === 'vote')) {
      const isSupportCommunity = community?.typeTag === 'support';
      
      if (isMarathonOfGood && walletAmount > 0) {
        throw new BadRequestException(
          'Marathon of Good only allows quota voting on posts and comments. Please use daily quota to vote.',
        );
      }
      if (isFutureVision && quotaAmount > 0) {
        throw new BadRequestException(
          'Future Vision only allows wallet voting on posts and comments. Please use wallet merits to vote.',
        );
      }
      // For regular groups (non-special, non-support), reject wallet voting
      // Support communities are treated like regular communities for voting purposes
      if (!isSpecialGroup && !isSupportCommunity && walletAmount > 0) {
        throw new BadRequestException(
          'Voting with permanent wallet merits is only allowed in special groups (Marathon of Good and Future Vision). Please use daily quota to vote on posts and comments.',
        );
      }
    }

    // Validation: reject quota for downvotes
    if (direction === 'down' && quotaAmount > 0) {
      throw new BadRequestException(
        'Quota cannot be used for downvotes (negative votes)',
      );
    }

    // Get available quota and wallet balance
    const remainingQuota = await this.getRemainingQuota(
      userId,
      communityId,
      community,
    );
    const walletBalance = await this.getWalletBalance(userId, communityId);

    // Validation: check quota limit (daily quota usage limit)
    if (quotaAmount > remainingQuota) {
      throw new BadRequestException(
        `Insufficient quota. Available: ${remainingQuota}, Requested: ${quotaAmount}`,
      );
    }

    // Validation: check wallet balance
    // Only walletAmount is deducted from wallet balance, quotaAmount is tracked separately
    // So we only need to check that walletAmount doesn't exceed walletBalance
    if (walletAmount > walletBalance) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ${walletBalance}, Requested: ${walletAmount} (quota: ${quotaAmount}, wallet: ${walletAmount})`,
      );
    }

    return { quotaAmount, walletAmount, totalAmount, direction };
  }

  /**
   * Handle vote creation for both publications and votes
   * Extracts shared logic between votePublication and voteVote
   */
  private async handleVoteCreation(
    targetType: 'publication' | 'vote',
    targetId: string,
    createDto: VoteWithCommentDto,
    req: any,
    options: {
      sendNotification?: boolean;
      updatePublicationMetrics?: boolean;
    } = {},
  ): Promise<{
    vote: Vote;
    communityId: string;
    direction: 'up' | 'down';
    absoluteAmount: number;
    quotaAmount: number;
    walletAmount: number;
  }> {
    // Get community ID based on target type
    let communityId: string;
    let publication: any = null;

    if (targetType === 'publication') {
      publication = await this.publicationService.getPublication(targetId);
      if (!publication) {
        throw new NotFoundError('Publication', targetId);
      }
      communityId = publication.getCommunityId.getValue();
    } else {
      // targetType === 'vote'
      const targetVote = await this.voteService.getVoteById(targetId);
      if (!targetVote) {
        throw new NotFoundError('Vote', targetId);
      }
      communityId = targetVote.communityId;
    }

    // Get community to get currency info (needed for wallet operations)
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }

    // Validate comment is provided
    // Note: Comment is optional in the schema but required by business logic
    const comment = (createDto as any).comment?.trim() || '';
    const commentRequiredMessage =
      targetType === 'publication'
        ? 'Comment is required'
        : 'Comment is required when voting on a vote';
    if (!comment) {
      this.logger.warn(`[handleVoteCreation] Missing comment: targetType=${targetType}, targetId=${targetId}, userId=${req.user?.id}, dto=${JSON.stringify(createDto)}`);
      throw new BadRequestException(commentRequiredMessage);
    }
    this.logger.log(`[handleVoteCreation] Comment validated: length=${comment.length}, targetType=${targetType}, targetId=${targetId}`);
    
    // Get images from DTO
    const images = (createDto as any).images || [];

    // Validate and process vote amounts (quotaAmount + walletAmount)
    const { quotaAmount, walletAmount, totalAmount, direction } =
      await this.validateAndProcessVoteAmounts(
        req.user.id,
        communityId,
        community,
        createDto,
        targetType,
      );

    const absoluteAmount = Math.abs(totalAmount);

    // Create votes atomically: quota vote first, then wallet vote if needed
    const vote = await this.createVoteWithQuotaAndWallet(
      req.user.id,
      targetType,
      targetId,
      quotaAmount,
      walletAmount,
      direction,
      communityId,
      community,
      comment,
      images,
    );

    return { vote, communityId, direction, absoluteAmount, quotaAmount, walletAmount };
  }

  @Post('publications/:id/votes')
  @ZodValidation(VoteWithCommentDtoSchema)
  @RequirePermission('vote', 'publication')
  async votePublication(
    @Param('id') id: string,
    @Body() createDto: VoteWithCommentDto,
    @Req() req: any,
  ) {
    this.logger.log(`[votePublication] START: publicationId=${id}, userId=${req.user?.id}, dto=${JSON.stringify(createDto)}`);
    // Get publication document directly from DB to check postType and isProject
    const publicationDoc = await this.publicationModel.findOne({ id }).lean();
    if (!publicationDoc) {
      throw new NotFoundError('Publication', id);
    }

    // Prevent voting on PROJECT posts
    if (
      publicationDoc.postType === 'project' ||
      publicationDoc.isProject === true
    ) {
      throw new BadRequestException(
        'Cannot vote on PROJECT posts. PROJECT posts are for discussion only and do not accept votes or merits.',
      );
    }

    // Get publication aggregate for further processing
    const publication = await this.publicationService.getPublication(id);
    if (!publication) {
      throw new NotFoundError('Publication', id);
    }

    let vote, communityId, direction, absoluteAmount, quotaAmount, walletAmount;
    try {
      this.logger.log(`[votePublication] Calling handleVoteCreation for publicationId=${id}, userId=${req.user?.id}`);
      ({ vote, communityId, direction, absoluteAmount, quotaAmount, walletAmount } =
        await this.handleVoteCreation('publication', id, createDto, req, {
          sendNotification: true,
          updatePublicationMetrics: true,
        }));
      this.logger.log(`[votePublication] handleVoteCreation succeeded: voteId=${vote?.id}, direction=${direction}, absoluteAmount=${absoluteAmount}, quotaAmount=${quotaAmount}, walletAmount=${walletAmount}`);
    } catch (error) {
      this.logger.error(`[votePublication] handleVoteCreation failed: ${error?.message || 'Unknown error'}`, error?.stack);
      throw error;
    }

    // Update publication metrics to reflect the vote immediately
    try {
      this.logger.log(`[votePublication] Calling publicationService.voteOnPublication for publicationId=${id}`);
      await this.publicationService.voteOnPublication(
        id,
        req.user.id,
        absoluteAmount,
        direction,
      );
      this.logger.log(`[votePublication] publicationService.voteOnPublication succeeded`);
    } catch (error) {
      this.logger.error(`[votePublication] publicationService.voteOnPublication failed: ${error.message}`, error.stack);
      throw error;
    }

    // Automatic merit crediting has been disabled
    // Merits are now only credited when users manually withdraw from their publications/comments
    // This allows users to control when they convert accumulated votes to permanent merits

    // Immediate notification if enabled for beneficiary
    try {
      const effectiveBeneficiary = publication.getEffectiveBeneficiary();
      const beneficiaryId = effectiveBeneficiary ? effectiveBeneficiary.getValue() : null;
      if (beneficiaryId) {
        const settings =
          await this.userSettingsService.getOrCreate(beneficiaryId);
        if (settings.updatesFrequency === 'immediate') {
          // Telegram notifications are disabled in this project; skip sending.
          this.logger.log(
            `Immediate updates enabled; Telegram notifications are disabled, skipping notification for beneficiary=${beneficiaryId} publication=${id}`,
          );
        }
      }
    } catch {}

    return ApiResponseHelper.successResponse(
      { vote },
      {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    );
  }

  @Get('publications/:id/votes')
  async getPublicationVotes(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.voteService.getTargetVotes('publication', id);
    return PaginationHelper.createResult(result, result.length, pagination);
  }

  @Delete('publications/:id/votes')
  async removePublicationVote(@Param('id') id: string, @Req() req: any) {
    await this.voteService.removeVote(req.user.id, 'publication', id);
    return ApiResponseHelper.successMessage('Vote removed successfully');
  }

  @Post('votes/:id/votes')
  @ZodValidation(VoteWithCommentDtoSchema)
  async voteVote(
    @Param('id') id: string,
    @Body() createDto: VoteWithCommentDto,
    @Req() req: any,
  ) {
    // Check feature flag - comment voting is disabled by default
    const enableCommentVoting = process.env.ENABLE_COMMENT_VOTING === 'true';
    if (!enableCommentVoting) {
      throw new BadRequestException(
        'Voting on comments is disabled. You can only vote on posts/publications.',
      );
    }

    const { vote } = await this.handleVoteCreation('vote', id, createDto, req);

    return ApiResponseHelper.successResponse(
      { vote },
      {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    );
  }

  @Get('votes/:id/replies')
  async getVoteReplies(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    // Validate that vote exists
    const vote = await this.voteService.getVoteById(id);
    if (!vote) {
      throw new NotFoundError('Vote', id);
    }

    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const limit = pagination.limit || 20;

    // Get votes on this vote
    const votes = await this.voteService.getVotesOnVote(id);

    // Sort votes
    const sortField = query.sort || 'createdAt';
    const sortOrder = (query.order || 'desc') === 'asc' ? 1 : -1;
    votes.sort((a, b) => {
      if (sortField === 'createdAt') {
        return (
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) *
          sortOrder
        );
      } else if (sortField === 'score') {
        // Calculate score as sum of quota and wallet amounts
        // Calculate score using stored direction field
        const amountA = (a.amountQuota || 0) + (a.amountWallet || 0);
        const amountB = (b.amountQuota || 0) + (b.amountWallet || 0);
        const scoreA = a.direction === 'up' ? amountA : -amountA;
        const scoreB = b.direction === 'up' ? amountB : -amountB;
        return (scoreA - scoreB) * sortOrder;
      }
      return 0;
    });

    // Apply pagination
    const paginatedVotes = votes.slice(skip, skip + limit);

    return PaginationHelper.createResult(
      paginatedVotes,
      votes.length,
      pagination,
    );
  }

  @Delete('votes/:id/votes')
  async removeVoteVote(@Param('id') id: string, @Req() req: any) {
    await this.voteService.removeVote(req.user.id, 'vote', id);
    return ApiResponseHelper.successMessage('Vote removed successfully');
  }

  @Get('votes/:id/details')
  async getVoteDetails(@Param('id') id: string, @Req() req: any) {
    // This would need to be implemented in VoteService
    return ApiResponseHelper.successResponse(
      { vote: null },
      {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    );
  }

  /**
   * Process withdrawal and credit wallet
   * Handles marathon-of-good → future-vision bridge
   */
  private async processWithdrawal(
    beneficiaryId: string,
    publicationCommunityId: string,
    publicationId: string,
    amount: number,
    referenceType: 'publication_withdrawal' | 'comment_withdrawal' | 'vote_withdrawal',
  ): Promise<{ targetCommunityId: string; currency: { singular: string; plural: string; genitive: string } }> {
    const publicationCommunity = await this.communityService.getCommunity(publicationCommunityId);
    if (!publicationCommunity) {
      throw new NotFoundError('Community', publicationCommunityId);
    }

    // Check if publication is in marathon-of-good - if so, credit Future Vision wallet
    if (publicationCommunity.typeTag === 'marathon-of-good') {
      const futureVisionCommunity =
        await this.communityService.getCommunityByTypeTag('future-vision');

      if (!futureVisionCommunity) {
        throw new NotFoundError('Community', 'future-vision');
      }

      const fvCurrency = futureVisionCommunity.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };

      // Credit Future Vision wallet
      await this.walletService.addTransaction(
        beneficiaryId,
        futureVisionCommunity.id,
        'credit',
        amount,
        'personal',
        referenceType,
        publicationId,
        fvCurrency,
        `Withdrawal from ${referenceType.replace('_withdrawal', '')} ${publicationId} (Marathon of Good → Future Vision)`,
      );

      this.logger.log(
        `Withdrew ${amount} merits to beneficiary ${beneficiaryId} in Future Vision (community: ${futureVisionCommunity.id}) from ${referenceType.replace('_withdrawal', '')} ${publicationId}`,
      );

      return {
        targetCommunityId: futureVisionCommunity.id,
        currency: fvCurrency,
      };
    }

    // For other communities, credit the publication's community wallet
    const currency = publicationCommunity.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    await this.walletService.addTransaction(
      beneficiaryId,
      publicationCommunityId,
      'credit',
      amount,
      'personal',
      referenceType,
      publicationId,
      currency,
      `Withdrawal from ${referenceType.replace('_withdrawal', '')} ${publicationId}`,
    );

    this.logger.log(
      `Withdrew ${amount} merits to beneficiary ${beneficiaryId} in community ${publicationCommunityId} from ${referenceType.replace('_withdrawal', '')} ${publicationId}`,
    );

    return {
      targetCommunityId: publicationCommunityId,
      currency,
    };
  }

  @Post('publications/:id/withdraw')
  @ZodValidation(WithdrawAmountDtoSchema)
  async withdrawFromPublication(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const amount = body.amount;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than 0');
    }

    // Get publication
    const publication = await this.publicationService.getPublication(id);
    if (!publication) {
      throw new NotFoundError('Publication', id);
    }

    // Validate user can withdraw
    const canWithdraw = await this.voteService.canUserWithdraw(
      userId,
      'publication',
      id,
    );
    if (!canWithdraw) {
      throw new BadRequestException('You are not authorized to withdraw from this publication');
    }

    // Get current score
    const currentScore = publication.getMetrics.score;
    if (currentScore <= 0) {
      throw new BadRequestException('No votes available to withdraw');
    }

    // Check total already withdrawn
    const totalWithdrawn = await this.walletService.getTotalWithdrawnByReference(
      'publication_withdrawal',
      id,
    );

    // Calculate available amount
    const availableAmount = currentScore - totalWithdrawn;
    if (amount > availableAmount) {
      throw new BadRequestException(
        `Insufficient votes to withdraw. Available: ${availableAmount}, Requested: ${amount}`,
      );
    }

    // Get effective beneficiary
    const effectiveBeneficiary = publication.getEffectiveBeneficiary();
    const beneficiaryId = effectiveBeneficiary.getValue();

    // Process withdrawal (handles marathon bridge)
    const communityId = publication.getCommunityId.getValue();
    const { targetCommunityId } = await this.processWithdrawal(
      beneficiaryId,
      communityId,
      id,
      amount,
      'publication_withdrawal',
    );

    // Reduce publication score
    await this.publicationService.reduceScore(id, amount);

    // Get updated wallet balance
    const wallet = await this.walletService.getWallet(beneficiaryId, targetCommunityId);
    const balance = wallet?.balance || 0;

    return ApiResponseHelper.successResponse({
      amount,
      balance,
      message: 'Withdrawal successful',
    });
  }

  @Post('votes/:id/withdraw')
  @ZodValidation(WithdrawAmountDtoSchema)
  async withdrawFromVote(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const amount = body.amount;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than 0');
    }

    // Get vote (which represents a comment)
    const vote = await this.voteService.getVoteById(id);
    if (!vote) {
      throw new NotFoundError('Vote', id);
    }

    // Validate user can withdraw
    const canWithdraw = await this.voteService.canUserWithdraw(
      userId,
      'vote',
      id,
    );
    if (!canWithdraw) {
      throw new BadRequestException('You are not authorized to withdraw from this comment');
    }

    // Get comment to get its score and find the publication
    const comment = await this.commentService.getComment(id);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }

    // Get current score
    const currentScore = comment.getScore();
    if (currentScore <= 0) {
      throw new BadRequestException('No votes available to withdraw');
    }

    // Check total already withdrawn
    const totalWithdrawn = await this.walletService.getTotalWithdrawnByReference(
      'vote_withdrawal',
      id,
    );

    // Calculate available amount
    const availableAmount = currentScore - totalWithdrawn;
    if (amount > availableAmount) {
      throw new BadRequestException(
        `Insufficient votes to withdraw. Available: ${availableAmount}, Requested: ${amount}`,
      );
    }

    // Find the root publication to get the community
    let publicationId: string | null = null;
    let currentComment = comment;
    let depth = 0;
    while (currentComment.getTargetType() === 'comment' && depth < 20) {
      const parentComment = await this.commentService.getComment(currentComment.getTargetId());
      if (!parentComment) break;
      currentComment = parentComment;
      depth++;
    }
    if (currentComment.getTargetType() === 'publication') {
      publicationId = currentComment.getTargetId();
    }

    if (!publicationId) {
      throw new BadRequestException('Could not find publication for this comment');
    }

    // Get publication to determine community
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      throw new NotFoundError('Publication', publicationId);
    }

    const communityId = publication.getCommunityId.getValue();

    // Get effective beneficiary (comment author)
    const beneficiaryId = comment.getAuthorId.getValue();

    // Process withdrawal (handles marathon bridge)
    const { targetCommunityId } = await this.processWithdrawal(
      beneficiaryId,
      communityId,
      id,
      amount,
      'vote_withdrawal',
    );

    // Reduce comment score
    await this.commentService.reduceScore(id, amount);

    // Get updated wallet balance
    const wallet = await this.walletService.getWallet(beneficiaryId, targetCommunityId);
    const balance = wallet?.balance || 0;

    return ApiResponseHelper.successResponse({
      amount,
      balance,
      message: 'Withdrawal successful',
    });
  }

}
