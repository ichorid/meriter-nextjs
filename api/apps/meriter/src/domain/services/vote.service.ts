import { Injectable, Logger, BadRequestException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { VoteSchemaClass, VoteDocument } from '../models/vote/vote.schema';
import type { Vote } from '../models/vote/vote.schema';
import { uid } from 'uid';
import { PublicationService } from './publication.service';
import { CommunityService } from './community.service';
import { PermissionService } from './permission.service';
import { UserService } from './user.service';
import { EventBus } from '../events/event-bus';
import { PublicationVotedEvent, CommentVotedEvent } from '../events';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD, COMMUNITY_ROLE_PARTICIPANT, COMMUNITY_ROLE_VIEWER } from '../common/constants/roles.constants';

@Injectable()
export class VoteService {
  private readonly logger = new Logger(VoteService.name);

  constructor(
    @InjectModel(VoteSchemaClass.name) private voteModel: Model<VoteDocument>,
    @InjectConnection() private mongoose: Connection,
    @Inject(forwardRef(() => PublicationService)) private publicationService: PublicationService,
    private communityService: CommunityService,
    @Inject(forwardRef(() => PermissionService)) private permissionService: PermissionService,
    private userService: UserService,
    private eventBus: EventBus,
  ) {}

  /**
   * Get the effective beneficiary for a target (publication or vote)
   * - For publications: beneficiaryId if set, otherwise authorId
   * - For votes: userId of the vote being voted on
   */
  private async getEffectiveBeneficiary(targetType: 'publication' | 'vote', targetId: string): Promise<string | null> {
    if (targetType === 'publication') {
      const publication = await this.publicationService.getPublication(targetId);
      if (!publication) {
        return null;
      }
      const effectiveBeneficiary = publication.getEffectiveBeneficiary();
      return effectiveBeneficiary ? effectiveBeneficiary.getValue() : null;
    } else {
      // targetId is a vote ID
      const vote = await this.getVoteById(targetId);
      if (!vote) {
        return null;
      }
      return vote.userId;
    }
  }

  /**
   * Check if user can vote on a publication or vote.
   * Rules:
   * - Superadmin can always vote (including self-votes)
   * - Cannot vote if user is the effective beneficiary (for regular users)
   * - Exception: In future-vision groups, participants/leads/superadmins can self-vote
   * - For publications: effective beneficiary = beneficiaryId if set, otherwise authorId
   * - For votes: effective beneficiary = userId of the vote being voted on (cannot vote on your own vote)
   */
  async canUserVote(userId: string, targetType: 'publication' | 'vote', targetId: string, communityId?: string): Promise<boolean> {
    // Check if user is superadmin - superadmins can always vote (including self-votes)
    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      this.logger.log(`[canUserVote] Superadmin ${userId} can vote on any content (including self-votes)`);
      return true;
    }

    const effectiveBeneficiary = await this.getEffectiveBeneficiary(targetType, targetId);
    if (!effectiveBeneficiary) {
      return false;
    }

    // Check voting restrictions from community settings
    if (communityId) {
      const community = await this.communityService.getCommunity(communityId);
      if (community?.votingSettings?.votingRestriction) {
        const restriction = community.votingSettings.votingRestriction;
        
        // Check if this is self-voting
        const isSelfVoting = effectiveBeneficiary === userId;
        
        // Check restriction: "not-own" - cannot vote for own posts
        if (restriction === 'not-own' && isSelfVoting) {
          // Exception: future-vision allows self-voting
          if (community.typeTag === 'future-vision') {
            const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);
            if (userRole === COMMUNITY_ROLE_PARTICIPANT || userRole === COMMUNITY_ROLE_LEAD || userRole === COMMUNITY_ROLE_SUPERADMIN) {
              return true; // Allow self-voting in future-vision group for these roles
            }
          }
          this.logger.log(`[canUserVote] DENIED: Cannot vote for own post (not-own restriction)`);
          return false;
        }
        
        // Check restriction: "not-same-group" - cannot vote if users share communities
        if (restriction === 'not-same-group' && !isSelfVoting) {
          const authorId = effectiveBeneficiary;
          const voterCommunities = await this.userService.getUserCommunities(userId);
          const authorCommunities = await this.userService.getUserCommunities(authorId);
          
          // Find shared communities (excluding special groups: future-vision, marathon-of-good, support)
          const specialTypeTags = ['future-vision', 'marathon-of-good', 'support'];
          const sharedCommunities = voterCommunities.filter(vcId => 
            authorCommunities.includes(vcId)
          );
          
          // Check if any shared community is NOT a special group
          for (const sharedCommId of sharedCommunities) {
            const sharedComm = await this.communityService.getCommunity(sharedCommId);
            if (sharedComm && !specialTypeTags.includes(sharedComm.typeTag || '')) {
              this.logger.log(`[canUserVote] DENIED: Users share non-special communities (not-same-group restriction)`);
              return false;
            }
          }
        }
        
        // Restriction "any" allows all votes (no additional checks needed)
        // If not self-voting and restriction is not "not-same-group", allow it
        if (!isSelfVoting && restriction !== 'not-same-group') {
          return true;
        }
      }
    }

    // Legacy check: if no voting restriction is set, use old logic
    // Check if this is self-voting
    const isSelfVoting = effectiveBeneficiary === userId;
    if (!isSelfVoting) {
      return true; // Not self-voting, allow it
    }

    // Self-voting: check if allowed in future-vision group
    if (communityId) {
      const community = await this.communityService.getCommunity(communityId);
      if (community?.typeTag === 'future-vision') {
        // Check user role - allow self-voting for participant, lead, or superadmin
        const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);
        if (userRole === COMMUNITY_ROLE_PARTICIPANT || userRole === COMMUNITY_ROLE_LEAD || userRole === COMMUNITY_ROLE_SUPERADMIN) {
          return true; // Allow self-voting in future-vision group for these roles
        }
      }
    }

    // Default: prevent self-voting
    return false;
  }

  /**
   * Check if user can withdraw from a publication or vote
   * Rules:
   * - Can withdraw only if user is the effective beneficiary
   * - For publications: effective beneficiary = beneficiaryId if set, otherwise authorId
   * - For votes: effective beneficiary = userId of the vote (can withdraw from your own vote)
   */
  async canUserWithdraw(userId: string, targetType: 'publication' | 'vote', targetId: string): Promise<boolean> {
    const effectiveBeneficiary = await this.getEffectiveBeneficiary(targetType, targetId);
    if (!effectiveBeneficiary) {
      return false;
    }
    return effectiveBeneficiary === userId;
  }

  async createVote(
    userId: string,
    targetType: 'publication' | 'vote',
    targetId: string,
    amountQuota: number,
    amountWallet: number,
    direction: 'up' | 'down',
    comment: string,
    communityId: string,
    images?: string[]
  ): Promise<Vote> {
    const commentPreview = (comment ?? '').substring(0, 50);
    this.logger.log(
      `Creating vote: user=${userId}, target=${targetType}:${targetId}, amountQuota=${amountQuota}, amountWallet=${amountWallet}, direction=${direction}, communityId=${communityId}, comment=${commentPreview}...`,
    );

    // Check feature flag - comment voting is disabled by default
    const enableCommentVoting = process.env.ENABLE_COMMENT_VOTING === 'true';
    if (targetType === 'vote' && !enableCommentVoting) {
      throw new BadRequestException(
        'Voting on comments is disabled. You can only vote on posts/publications.',
      );
    }

    // Validate that user can vote (mutual exclusivity check)
    // Pass communityId to allow self-voting in future-vision groups
    const canVote = await this.canUserVote(userId, targetType, targetId, communityId);
    if (!canVote) {
      throw new BadRequestException('Cannot vote: you are the effective beneficiary of this content');
    }

    // Validate that at least one amount is positive
    if (amountQuota <= 0 && amountWallet <= 0) {
      throw new BadRequestException('At least one of amountQuota or amountWallet must be greater than zero');
    }

    // Validate amounts are non-negative
    if (amountQuota < 0 || amountWallet < 0) {
      throw new BadRequestException('Vote amounts cannot be negative');
    }

    // Validate comment is provided (can be empty string but field must exist)
    if (comment === undefined || comment === null) {
      throw new BadRequestException('Comment is required');
    }

    // Check if community is a special group (marathon-of-good or future-vision)
    const community = await this.communityService.getCommunity(communityId);
    const isMarathonOfGood = community?.typeTag === 'marathon-of-good';
    const isFutureVision = community?.typeTag === 'future-vision';

    // Check user role to enforce viewer restrictions (check BEFORE community-specific rules)
    const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);
    
    // Viewers can only vote with quota (no wallet voting) - check this first for clearer error messages
    if (userRole === COMMUNITY_ROLE_VIEWER && amountWallet > 0) {
      throw new BadRequestException(
        'Viewers can only vote using daily quota, not wallet merits.',
      );
    }

    // Wallet voting is allowed by default for all groups
    // Special case restrictions:
    // - Marathon of Good: Block wallet voting on publications/comments (quota only)
    // - Future Vision: Block quota voting on publications/comments (wallet only)
    // - Viewers: Block wallet voting (quota only) - already checked above
    // Polls are handled separately and always use wallet
    // This check comes BEFORE postType validation to ensure it applies
    if (targetType === 'publication' || targetType === 'vote') {
      // Special case: Marathon of Good blocks wallet voting (quota only)
      if (isMarathonOfGood && amountWallet > 0 && userRole !== COMMUNITY_ROLE_VIEWER) {
        throw new BadRequestException(
          'Marathon of Good only allows quota voting on posts and comments. Please use daily quota to vote.',
        );
      }
      // Special case: Future Vision blocks quota voting (wallet only)
      if (isFutureVision && amountQuota > 0) {
        throw new BadRequestException(
          'Future Vision only allows wallet voting on posts and comments. Please use wallet merits to vote.',
        );
      }
      // All other groups allow wallet voting by default (no restriction needed)
    }

    // Enforce voting rules based on target type
    if (targetType === 'publication') {
      const publication = await this.publicationService.getPublication(targetId);
      if (!publication) {
        throw new NotFoundException('Publication not found');
      }

      const postType = publication.getPostType;
      const isProject = publication.getIsProject;

      // Project (Idea): Voting with wallet (Merits) only
      if (postType === 'project' || isProject) {
        if (amountQuota > 0) {
          throw new BadRequestException(
            'Projects can only be voted on with Merits (Wallet), not Daily Quota',
          );
        }
        if (amountWallet <= 0) {
          throw new BadRequestException(
            'Projects require Merits (Wallet) to vote',
          );
        }
      }

      // Report (Good Deed) / Basic: Wallet voting allowed by default
      // Special case: Marathon of Good blocks wallet for basic posts (quota only, already enforced above)
      // Special case: Future Vision blocks quota for basic posts (wallet only, already enforced above)
      // All other groups allow wallet voting for basic posts by default
      // Assuming 'basic' implies Report/Good Deed context for now
      if (postType === 'basic' && !isProject) {
        // Marathon of Good: basic posts require quota (wallet already blocked above)
        if (isMarathonOfGood && amountQuota <= 0) {
          throw new BadRequestException(
            'Reports require Daily Quota to vote',
          );
        }
        // Future Vision: basic posts require wallet (quota already blocked above)
        if (isFutureVision && amountWallet <= 0) {
          throw new BadRequestException(
            'Reports require Wallet Merits to vote',
          );
        }
      }
    }

    // Allow multiple votes on the same content - remove the duplicate check
    // Users can vote multiple times on the same publication/vote

    // Create vote with explicit direction
    const voteArray = await this.voteModel.create([{
      id: uid(),
      targetType,
      targetId,
      userId,
      amountQuota,
      amountWallet,
      direction,
      communityId,
      comment: comment.trim(),
      images: images || [],
      createdAt: new Date(),
    }]);

    const vote = voteArray[0];
    this.logger.log(`Vote created successfully: ${vote.id}`);

    // Publish domain event for notifications
    const totalAmount = amountQuota + amountWallet;
    if (targetType === 'publication') {
      await this.eventBus.publish(
        new PublicationVotedEvent(targetId, userId, totalAmount, direction),
      );
    } else {
      // Vote on vote = comment vote
      await this.eventBus.publish(
        new CommentVotedEvent(vote.id, userId, totalAmount, direction),
      );
    }

    return vote;
  }

  async removeVote(userId: string, targetType: 'publication' | 'vote', targetId: string): Promise<boolean> {
    this.logger.log(`Removing vote: user=${userId}, target=${targetType}:${targetId}`);

    const result = await this.voteModel.deleteOne(
      { userId, targetType, targetId }
    );

    if (result.deletedCount > 0) {
      this.logger.log(`Vote removed successfully`);
    }

    return result.deletedCount > 0;
  }

  async getUserVotes(userId: string, limit: number = 100, skip: number = 0): Promise<Vote[]> {
    return this.voteModel
      .find({ userId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async getVoteById(voteId: string): Promise<Vote | null> {
    return this.voteModel.findOne({ id: voteId }).lean().exec();
  }

  async getTargetVotes(targetType: string, targetId: string): Promise<Vote[]> {
    return this.voteModel.find({ targetType, targetId }).lean().exec();
  }

  async getVotesOnVote(voteId: string): Promise<Vote[]> {
    return this.voteModel.find({ targetType: 'vote', targetId: voteId }).lean().exec();
  }

  async getVotesOnVotes(voteIds: string[]): Promise<Map<string, Vote[]>> {
    if (voteIds.length === 0) return new Map();

    const votes = await this.voteModel
      .find({ targetType: 'vote', targetId: { $in: voteIds } })
      .lean()
      .exec();

    const votesMap = new Map<string, Vote[]>();
    votes.forEach(vote => {
      const existing = votesMap.get(vote.targetId) || [];
      existing.push(vote);
      votesMap.set(vote.targetId, existing);
    });

    return votesMap;
  }

  async getVotesOnPublication(publicationId: string): Promise<Vote[]> {
    return this.voteModel
      .find({
        targetType: 'publication',
        targetId: publicationId,
      })
      .lean()
      .exec();
  }

  /**
   * Get votes on a publication with pagination and sorting
   * Note: score sorting is done client-side after fetching votes on votes
   */
  async getPublicationVotes(
    publicationId: string,
    limit: number = 50,
    skip: number = 0,
    sortField: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<Vote[]> {
    // For score sorting, we need to fetch all votes first to calculate scores
    // For other fields, we can sort in the query
    if (sortField === 'score') {
      // Fetch all votes (we'll sort after calculating scores)
      const allVotes = await this.voteModel
        .find({
          targetType: 'publication',
          targetId: publicationId,
        })
        .lean()
        .exec();

      // Calculate scores for each vote (sum of votes on votes)
      const voteIds = allVotes.map(v => v.id);
      const votesOnVotesMap = await this.getVotesOnVotes(voteIds);

      // Add score to each vote
      const votesWithScores = allVotes.map(vote => ({
        ...vote,
        _score: (votesOnVotesMap.get(vote.id) || []).reduce((sum, r) => sum + (r.amountQuota + r.amountWallet), 0),
      }));

      // Sort by score
      votesWithScores.sort((a, b) => {
        return sortOrder === 'asc' ? a._score - b._score : b._score - a._score;
      });

      // Apply pagination
      return votesWithScores.slice(skip, skip + limit);
    }

    // For other fields, sort in MongoDB query
    const sortValue = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortValue };

    return this.voteModel
      .find({
        targetType: 'publication',
        targetId: publicationId,
      })
      .limit(limit)
      .skip(skip)
      .sort(sort as any)
      .lean()
      .exec();
  }

  async hasUserVoted(userId: string, targetType: string, targetId: string): Promise<boolean> {
    const vote = await this.voteModel.findOne({ userId, targetType, targetId }).lean();
    return vote !== null;
  }

  async hasVoted(userId: string, targetType: 'publication' | 'vote', targetId: string): Promise<boolean> {
    return this.hasUserVoted(userId, targetType, targetId);
  }

  /**
   * Returns the sum of vote amounts cast ON the given vote.
   * Uses MongoDB aggregation to avoid loading all documents.
   */
  async getPositiveSumForVote(voteId: string): Promise<number> {
    const result = await this.voteModel.aggregate([
      { $match: { targetType: 'vote', targetId: voteId } },
      { $project: { totalAmount: { $add: ['$amountQuota', '$amountWallet'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]).exec();
    return (result && result[0] && result[0].total) || 0;
  }

}
