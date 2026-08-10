import { Injectable, Logger, BadRequestException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import {
  PERMISSION_GATES_PORT,
  PermissionGatesPort,
} from '../ports/permission-gates.port';
import {
  VOTE_PERSISTENCE_PORT,
  type VotePersistencePort,
  type VotePersistenceSession,
  type VoteRecord,
  type VoteTargetType,
} from '../ports/vote.persistence.port';
import { uid } from 'uid';
import { PublicationService } from './publication.service';
import { CommunityService } from './community.service';
import { PermissionService } from './permission.service';
import { UserService } from './user.service';
import { VoteFactorService } from './vote-factor.service';
import { EventBus } from '../events/event-bus';
import { PublicationVotedEvent, CommentVotedEvent } from '../events';
import { DocumentService } from './document.service';
import { parseOfficialBlockVoteTargetId } from '../common/document-official-vote.util';

export type Vote = VoteRecord;

@Injectable()
export class VoteService {
  private readonly logger = new Logger(VoteService.name);

  constructor(
    @Inject(VOTE_PERSISTENCE_PORT)
    private readonly votePersistence: VotePersistencePort,
    @Inject(forwardRef(() => PublicationService)) private publicationService: PublicationService,
    @Inject(forwardRef(() => CommunityService)) private communityService: CommunityService,
    @Inject(forwardRef(() => PermissionService)) private permissionService: PermissionService,
    @Inject(forwardRef(() => UserService)) private userService: UserService,
    private voteFactorService: VoteFactorService,
    private eventBus: EventBus,
    @Inject(forwardRef(() => DocumentService))
    private documentService: DocumentService,
    @Inject(PERMISSION_GATES_PORT)
    private permissionGates: PermissionGatesPort,
  ) {}

  private async getEffectiveBeneficiary(
    targetType: VoteTargetType,
    targetId: string,
  ): Promise<string | null> {
    if (targetType === 'document-block-official') {
      const parsed = parseOfficialBlockVoteTargetId(targetId);
      if (!parsed) {
        return null;
      }
      return `official-block:${parsed.blockId}`;
    }
    if (targetType === 'document-variant') {
      const variant = await this.documentService.getVariantById(targetId);
      return variant ? variant.proposedBy : null;
    }
    if (targetType === 'publication') {
      const publication = await this.publicationService.getPublication(targetId);
      if (!publication) {
        return null;
      }
      const effectiveBeneficiary = publication.getEffectiveBeneficiary();
      return effectiveBeneficiary ? effectiveBeneficiary.getValue() : null;
    }
    const vote = await this.getVoteById(targetId);
    if (!vote) {
      return null;
    }
    return vote.userId;
  }

  async canUserWithdraw(userId: string, targetType: 'publication' | 'vote', targetId: string): Promise<boolean> {
    const effectiveBeneficiary = await this.getEffectiveBeneficiary(targetType, targetId);
    if (!effectiveBeneficiary) {
      return false;
    }
    return effectiveBeneficiary === userId;
  }

  async createVote(
    userId: string,
    targetType: VoteTargetType,
    targetId: string,
    amountQuota: number,
    amountWallet: number,
    direction: 'up' | 'down',
    comment: string,
    communityId: string,
    images?: string[],
    session?: VotePersistenceSession,
  ): Promise<Vote> {
    const commentPreview = (comment ?? '').substring(0, 50);
    this.logger.log(
      `Creating vote: user=${userId}, target=${targetType}:${targetId}, amountQuota=${amountQuota}, amountWallet=${amountWallet}, direction=${direction}, communityId=${communityId}, comment=${commentPreview}...`,
    );

    if (targetType === 'vote' && !this.permissionGates.isCommentVotingEnabled()) {
      throw new BadRequestException(
        'Voting on comments is disabled. You can only vote on posts/publications.',
      );
    }

    if (amountQuota < 0 || amountWallet < 0) {
      throw new BadRequestException('Vote amounts cannot be negative');
    }
    if (amountQuota === 0 && amountWallet === 0 && !(comment?.trim?.())) {
      throw new BadRequestException('Neutral comment must include comment text');
    }

    if (comment === undefined || comment === null) {
      throw new BadRequestException('Comment is required');
    }

    const effectiveBeneficiaryId = await this.getEffectiveBeneficiary(targetType, targetId);
    if (!effectiveBeneficiaryId) {
      if (targetType === 'publication') {
        throw new NotFoundException('Publication not found');
      }
      if (targetType === 'document-variant' || targetType === 'document-block-official') {
        throw new NotFoundException('Document vote target not found');
      }
      throw new NotFoundException('Vote not found');
    }

    const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);

    let postType: string | undefined;
    let isProject: boolean | undefined;
    if (targetType === 'publication') {
      const publication = await this.publicationService.getPublication(targetId);
      if (!publication) {
        throw new NotFoundException('Publication not found');
      }
      postType = publication.getPostType;
      isProject = publication.getIsProject;
    }

    const voterTeamCommunities = await this.getTeamCommunitiesForUser(userId);
    const beneficiaryTeamCommunities = await this.getTeamCommunitiesForUser(effectiveBeneficiaryId);
    const sharedTeamCommunities = voterTeamCommunities.filter((id) =>
      beneficiaryTeamCommunities.includes(id),
    );

    const totalAmount = amountQuota + amountWallet;
    const isNeutralComment = totalAmount === 0;

    if (!isNeutralComment) {
      const currencyMode = await this.voteFactorService.evaluateCurrencyMode(
        userId,
        communityId,
        effectiveBeneficiaryId,
        targetType,
        postType,
        isProject,
        direction,
        userRole,
        sharedTeamCommunities,
      );

      if (!currencyMode.allowedQuota && amountQuota > 0) {
        throw new BadRequestException(
          currencyMode.reason || 'Quota voting is not allowed for this vote',
        );
      }

      if (!currencyMode.allowedWallet && amountWallet > 0) {
        throw new BadRequestException(
          currencyMode.reason || 'Wallet voting is not allowed for this vote',
        );
      }

      if (currencyMode.requiredCurrency === 'quota' && amountQuota <= 0) {
        throw new BadRequestException(
          currencyMode.reason || 'Quota voting is required for this vote',
        );
      }

      if (currencyMode.requiredCurrency === 'wallet' && amountWallet <= 0) {
        throw new BadRequestException(
          currencyMode.reason || 'Wallet voting is required for this vote',
        );
      }
    }

    const vote = await this.votePersistence.createVote(
      {
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
      },
      session,
    );

    this.logger.log(`Vote created successfully: ${vote.id}`);

    if (targetType === 'publication') {
      await this.eventBus.publish(
        new PublicationVotedEvent(targetId, userId, totalAmount, direction),
      );
    } else if (targetType === 'vote') {
      await this.eventBus.publish(
        new CommentVotedEvent(vote.id, userId, totalAmount, direction),
      );
    }

    return vote;
  }

  async removeVote(
    userId: string,
    targetType: 'publication' | 'vote' | 'document-variant',
    targetId: string,
  ): Promise<boolean> {
    this.logger.log(`Removing vote: user=${userId}, target=${targetType}:${targetId}`);

    const removed = await this.votePersistence.deleteVoteByUserTarget(
      userId,
      targetType,
      targetId,
    );

    if (removed) {
      this.logger.log(`Vote removed successfully`);
    }

    return removed;
  }

  async getUserVotes(userId: string, limit: number = 100, skip: number = 0): Promise<Vote[]> {
    return this.votePersistence.findVotesByUserId(userId, limit, skip);
  }

  async getVoteById(voteId: string): Promise<Vote | null> {
    return this.votePersistence.findVoteById(voteId);
  }

  async getTargetVotes(targetType: string, targetId: string): Promise<Vote[]> {
    return this.votePersistence.findVotesByTarget(targetType, targetId);
  }

  async getDocumentBlockPanelVotes(
    documentId: string,
    blockId: string,
    variantIds: string[],
  ): Promise<Vote[]> {
    return this.votePersistence.findDocumentBlockPanelVotes(documentId, blockId, variantIds);
  }

  async getVotesOnVote(voteId: string): Promise<Vote[]> {
    return this.votePersistence.findVotesOnVote(voteId);
  }

  async getVotesOnVotes(voteIds: string[]): Promise<Map<string, Vote[]>> {
    if (voteIds.length === 0) return new Map();

    const votes = await this.votePersistence.findVotesOnVotes(voteIds);
    const votesMap = new Map<string, Vote[]>();
    votes.forEach((vote) => {
      const existing = votesMap.get(vote.targetId) || [];
      existing.push(vote);
      votesMap.set(vote.targetId, existing);
    });

    return votesMap;
  }

  async getVotesOnPublication(publicationId: string): Promise<Vote[]> {
    return this.votePersistence.findVotesOnPublication(publicationId);
  }

  async getPublicationVotes(
    publicationId: string,
    limit: number = 50,
    skip: number = 0,
    sortField: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<Vote[]> {
    return this.votePersistence.findPublicationVotes({
      publicationId,
      limit,
      skip,
      sortField,
      sortOrder,
    });
  }

  async hasUserVoted(userId: string, targetType: string, targetId: string): Promise<boolean> {
    return this.votePersistence.hasUserVote(userId, targetType, targetId);
  }

  async hasVoted(
    userId: string,
    targetType: 'publication' | 'vote' | 'document-variant',
    targetId: string,
  ): Promise<boolean> {
    return this.hasUserVoted(userId, targetType, targetId);
  }

  private async getTeamCommunitiesForUser(userId: string): Promise<string[]> {
    const userCommunities = await this.userService.getUserCommunities(userId);
    const teamCommunities: string[] = [];
    for (const communityId of userCommunities) {
      const community = await this.communityService.getCommunity(communityId);
      if (community?.typeTag === 'team') {
        teamCommunities.push(communityId);
      }
    }
    return teamCommunities;
  }

  async getPositiveSumForVote(voteId: string): Promise<number> {
    return this.votePersistence.sumPositiveAmountsOnVote(voteId);
  }
}
