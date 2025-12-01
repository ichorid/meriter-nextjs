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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { VoteService } from '../../domain/services/vote.service';
import { UserSettingsService } from '../../domain/services/user-settings.service';
import { UserUpdatesService } from '../../domain/services/user-updates.service';
import { PublicationService } from '../../domain/services/publication.service';
import { UserService } from '../../domain/services/user.service';
import { WalletService } from '../../domain/services/wallet.service';
import { CommunityService } from '../../domain/services/community.service';
import { PermissionService } from '../../domain/services/permission.service';
import { UserGuard } from '../../user.guard';
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
  Publication as PublicationSchema,
  PublicationDocument,
} from '../../domain/models/publication/publication.schema';

@ApiTags('Votes')
@Controller('api/v1')
@UseGuards(UserGuard)
@ApiCookieAuth('jwt')
@ApiBearerAuth()
export class VotesController {
  private readonly logger = new Logger(VotesController.name);

  constructor(
    private readonly voteService: VoteService,
    private readonly publicationService: PublicationService,
    private readonly userService: UserService,
    private readonly walletService: WalletService,
    private readonly communityService: CommunityService,
    private readonly userSettingsService: UserSettingsService,
    private readonly userUpdatesService: UserUpdatesService,
    private readonly permissionService: PermissionService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(PublicationSchema.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) { }

  /**
   * Calculate remaining quota for a user in a community
   */
  private async getRemainingQuota(
    userId: string,
    communityId: string,
    community: any,
  ): Promise<number> {
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

    const usedToday = await this.connection.db
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
      .toArray();

    const used = usedToday.length > 0 ? usedToday[0].total : 0;
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
    isDownvote: boolean,
    communityId: string,
    community: any,
    comment: string,
  ): Promise<any> {
    // Validate that quota is not used for downvotes
    if (isDownvote && quotaAmount > 0) {
      throw new BadRequestException('Quota cannot be used for downvotes');
    }

    // Create single vote with both amounts
    const vote = await this.voteService.createVote(
      userId,
      targetType,
      targetId,
      quotaAmount,
      walletAmount,
      comment,
      communityId,
    );

    // Deduct from wallet if wallet amount is used
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
        `Vote on ${targetType} ${targetId}`,
      );
    }

    return vote;
  }

  /**
   * Credit user wallet with automatic merit conversion for GDM Representatives
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
    // Check if this is Good Deeds Marathon and user is Representative
    let isGdmRepresentative = false;
    if (community.typeTag === 'marathon-of-good') {
      const userRole = await this.permissionService.getUserRoleInCommunity(
        userId,
        communityId,
      );
      if (userRole === 'lead') {
        isGdmRepresentative = true;
      }
    }

    // If GDM Representative, credit ONLY Future Vision wallet
    if (isGdmRepresentative) {
      // Find Future Vision community
      const futureVisionCommunity =
        await this.communityService.getCommunityByTypeTag('future-vision');

      if (futureVisionCommunity) {
        const fvCurrency = futureVisionCommunity.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };

        // Credit Future Vision wallet (converted merits)
        await this.walletService.addTransaction(
          userId,
          futureVisionCommunity.id,
          'credit',
          amount,
          'personal',
          'merit_transfer_gdm_to_fv',
          referenceId,
          fvCurrency,
          `Converted merits from GDM: ${description}`,
        );

        this.logger.log(
          `Awarded ${amount} converted merits to Representative ${userId} in Future Vision from GDM reference ${referenceId}`,
        );
      } else {
        this.logger.warn(
          `Future Vision community not found for merit conversion. Crediting GDM instead.`,
        );
        // Fallback: credit GDM if FV not found
        isGdmRepresentative = false;
      }
    }

    // If NOT GDM Representative (or fallback), credit the original community wallet
    if (!isGdmRepresentative) {
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
  }

  /**
   * Award merits to beneficiary after voting
   * For Good Deeds Marathon: awards to Representative's wallet in GDM
   * Also implements shared merits: if GDM, also credits FV wallet (if user is Representative)
   */
  private async awardMeritsToBeneficiary(
    publication: any,
    communityId: string,
    amount: number,
    community: any,
  ): Promise<void> {
    const beneficiaryId = publication.getEffectiveBeneficiary()?.getValue();
    if (!beneficiaryId) {
      return;
    }

    await this.creditUserWithConversion(
      beneficiaryId,
      communityId,
      amount,
      community,
      'publication_vote',
      publication.getId.getValue(),
      `Merits from vote on publication ${publication.getId.getValue()}`,
    );
  }

  /**
   * Validate and process quotaAmount and walletAmount
   * Returns { quotaAmount, walletAmount, totalAmount, isDownvote }
   * Note: Downvotes are determined by having quotaAmount === 0 and walletAmount > 0
   */
  private async validateAndProcessVoteAmounts(
    userId: string,
    communityId: string,
    community: any,
    createDto: VoteWithCommentDto | any,
  ): Promise<{
    quotaAmount: number;
    walletAmount: number;
    totalAmount: number;
    isDownvote: boolean;
  }> {
    const quotaAmount = createDto.quotaAmount ?? 0;
    const walletAmount = createDto.walletAmount ?? 0;
    const totalAmount = quotaAmount + walletAmount;

    // Downvotes are indicated by quotaAmount === 0 and walletAmount > 0
    // This is inferred from the fact that quota cannot be used for downvotes
    const isDownvote = quotaAmount === 0 && walletAmount > 0;

    // Validation: reject double-zero votes
    if (quotaAmount === 0 && walletAmount === 0) {
      throw new BadRequestException(
        'Cannot vote with zero quota and zero wallet amount',
      );
    }

    // Validation: reject quota for downvotes (only check if explicitly downvote)
    // Note: We determine downvote by quotaAmount === 0, so this check is redundant
    // but kept for clarity
    if (isDownvote && quotaAmount > 0) {
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

    // Validation: check quota limit
    if (quotaAmount > remainingQuota) {
      throw new BadRequestException(
        `Insufficient quota. Available: ${remainingQuota}, Requested: ${quotaAmount}`,
      );
    }

    // Validation: check wallet balance
    if (walletAmount > walletBalance) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ${walletBalance}, Requested: ${walletAmount}`,
      );
    }

    // Validation: total vote amount should not exceed available quota + wallet
    if (totalAmount > remainingQuota + walletBalance) {
      throw new BadRequestException(
        `Insufficient total balance. Available: ${remainingQuota + walletBalance}, Requested: ${totalAmount}`,
      );
    }

    return { quotaAmount, walletAmount, totalAmount, isDownvote };
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
    const comment = (createDto as any).comment?.trim() || '';
    const commentRequiredMessage =
      targetType === 'publication'
        ? 'Comment is required'
        : 'Comment is required when voting on a vote';
    if (!comment) {
      throw new BadRequestException(commentRequiredMessage);
    }

    // Validate and process vote amounts (quotaAmount + walletAmount)
    const { quotaAmount, walletAmount, totalAmount, isDownvote } =
      await this.validateAndProcessVoteAmounts(
        req.user.id,
        communityId,
        community,
        createDto,
      );

    // Determine vote direction
    const direction: 'up' | 'down' = isDownvote ? 'down' : 'up';
    const absoluteAmount = Math.abs(totalAmount);

    // Create votes atomically: quota vote first, then wallet vote if needed
    const vote = await this.createVoteWithQuotaAndWallet(
      req.user.id,
      targetType,
      targetId,
      quotaAmount,
      walletAmount,
      isDownvote,
      communityId,
      community,
      comment,
    );

    return { vote, communityId, direction, absoluteAmount };
  }

  @Post('publications/:id/votes')
  @ZodValidation(VoteWithCommentDtoSchema)
  async votePublication(
    @Param('id') id: string,
    @Body() createDto: VoteWithCommentDto,
    @Req() req: any,
  ) {
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

    // Check permissions using PermissionService
    const canVote = await this.permissionService.canVote(req.user.id, id);
    if (!canVote) {
      // Get more specific error message
      const authorId = publication.getAuthorId.getValue();
      const userRole = await this.permissionService.getUserRoleInCommunity(
        req.user.id,
        publication.getCommunityId.getValue(),
      );
      const authorRole = await this.permissionService.getUserRoleInCommunity(
        authorId,
        publication.getCommunityId.getValue(),
      );

      let errorMessage =
        'You do not have permission to vote on this publication';

      // Provide specific error messages
      if (authorId === req.user.id) {
        errorMessage = 'You cannot vote for your own post';
      } else if (
        userRole === 'participant' &&
        authorRole === 'lead' &&
        publication.getCommunityId.getValue()
      ) {
        const community = await this.communityService.getCommunity(
          publication.getCommunityId.getValue(),
        );
        if (community?.typeTag === 'marathon-of-good') {
          errorMessage =
            'Members cannot vote for Representative posts in Good Deeds Marathon';
        } else {
          errorMessage =
            'Participants cannot vote for Representative posts in this community';
        }
      }

      throw new BadRequestException(errorMessage);
    }

    const { vote, communityId, direction, absoluteAmount } =
      await this.handleVoteCreation('publication', id, createDto, req, {
        sendNotification: true,
        updatePublicationMetrics: true,
      });

    // Update publication metrics to reflect the vote immediately
    await this.publicationService.voteOnPublication(
      id,
      req.user.id,
      absoluteAmount,
      direction,
    );

    // Award merits to beneficiary if this is an upvote
    // According to concept: "All merits collected by posts with good deeds go to the wallet of the Team Representative who published the post"
    if (direction === 'up' && absoluteAmount > 0) {
      // Get community for currency info
      const community = await this.communityService.getCommunity(communityId);
      if (community) {
        await this.awardMeritsToBeneficiary(
          publication,
          communityId,
          absoluteAmount,
          community,
        );
      }
    }

    // Immediate notification if enabled for beneficiary
    try {
      const beneficiaryId = publication.getEffectiveBeneficiary()?.getValue();
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
    } catch { }

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
    const limit = pagination.limit;

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
        const scoreA = (a.amountQuota || 0) + (a.amountWallet || 0);
        const scoreB = (b.amountQuota || 0) + (b.amountWallet || 0);
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

  @Post('publications/:id/withdraw')
  @ZodValidation(WithdrawAmountDtoSchema)
  async withdrawFromPublication(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // Get the publication
    const publication = await this.publicationService.getPublication(id);
    if (!publication) {
      throw new NotFoundError('Publication', id);
    }

    // Check if user can withdraw
    const canWithdraw = await this.voteService.canUserWithdraw(
      req.user.id,
      'publication',
      id,
    );
    if (!canWithdraw) {
      throw new BadRequestException(
        'You are not authorized to withdraw from this publication',
      );
    }

    // Check balance
    const balance = publication.getScore;
    if (balance <= 0) {
      throw new BadRequestException('No balance available to withdraw');
    }

    // Get beneficiary (beneficiaryId if set, otherwise authorId)
    const beneficiaryId =
      publication.getBeneficiaryId?.getValue() ||
      publication.getAuthorId.getValue();
    const communityId = publication.getCommunityId.getValue();

    // Get community to get currency info
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }

    // Get withdrawable amount (if amount specified, use it, otherwise withdraw all)
    const withdrawAmount = body.amount
      ? Math.min(body.amount, balance)
      : balance;

    if (withdrawAmount <= 0) {
      throw new BadRequestException('Withdraw amount must be positive');
    }

    // Transfer to wallet using shared method with conversion logic
    await this.creditUserWithConversion(
      beneficiaryId,
      communityId,
      withdrawAmount,
      community,
      'publication_withdrawal',
      id,
      `Withdrawal from publication ${id}`,
    );

    // Update publication metrics
    await this.publicationService.voteOnPublication(
      id,
      req.user.id,
      withdrawAmount,
      'down',
    );

    return ApiResponseHelper.successResponse(
      {
        amount: withdrawAmount,
        balance: balance - withdrawAmount,
        message: `Successfully withdrew ${withdrawAmount} from publication`,
      },
      {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    );
  }

  @Post('votes/:id/withdraw')
  @ZodValidation(WithdrawAmountDtoSchema)
  async withdrawFromVote(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // Get the vote
    const vote = await this.voteService.getVoteById(id);
    if (!vote) {
      throw new NotFoundError('Vote', id);
    }

    // Check if user can withdraw (must be the vote author)
    const canWithdraw = await this.voteService.canUserWithdraw(
      req.user.id,
      'vote',
      id,
    );
    if (!canWithdraw) {
      throw new BadRequestException(
        'You are not authorized to withdraw from this vote',
      );
    }

    // Get votes on this vote to calculate balance
    const votesOnVote = await this.voteService.getVotesOnVote(id);
    const balance = votesOnVote.reduce(
      (sum, v) => sum + ((v.amountQuota || 0) + (v.amountWallet || 0)),
      0,
    );

    if (balance <= 0) {
      throw new BadRequestException('No balance available to withdraw');
    }

    // Get beneficiary (vote author)
    const beneficiaryId = vote.userId;
    const communityId = vote.communityId;

    // Get community to get currency info
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }

    // Get withdrawable amount (if amount specified, use it, otherwise withdraw all)
    const withdrawAmount = body.amount
      ? Math.min(body.amount, balance)
      : balance;

    if (withdrawAmount <= 0) {
      throw new BadRequestException('Withdraw amount must be positive');
    }

    // Transfer to wallet using shared method with conversion logic
    await this.creditUserWithConversion(
      beneficiaryId,
      communityId,
      withdrawAmount,
      community,
      'vote_withdrawal',
      id,
      `Withdrawal from vote ${id}`,
    );

    return ApiResponseHelper.successResponse(
      {
        amount: withdrawAmount,
        balance: balance - withdrawAmount,
        message: `Successfully withdrew ${withdrawAmount} from vote`,
      },
      {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    );
  }

  @Post('publications/:id/vote-with-comment')
  @ZodValidation(VoteWithCommentDtoSchema)
  async votePublicationWithComment(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    // This endpoint is now redundant since votePublication requires comment
    // But keeping for backward compatibility - redirect to votePublication logic
    return this.votePublication(id, body, req);
  }
}
