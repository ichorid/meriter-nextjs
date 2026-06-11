import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Connection } from 'mongoose';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import { isPublicationEntitySourced } from '../../../domain/common/helpers/publication-source.helper';
import type { DocumentBlockVariantSchemaClass } from '../../../domain/models/document-block-variant/document-block-variant.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { DocumentService } from '../../../domain/services/document.service';
import type { DocumentVariantService } from '../../../domain/services/document-variant.service';
import type { WalletContextResolverService } from '../../../domain/services/wallet-context-resolver.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { VoteService } from '../../../domain/services/vote.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import {
  applyDocumentVoteRatingDelta,
  isDocumentVoteTargetType,
  resolveDocumentVoteContext,
  type DocumentVoteTargetType,
} from './document-vote.helper';
import {
  getCommunityIdFromTarget,
  getRemainingQuota,
  getWalletBalance,
  shouldUseProjectInstantAppreciation,
  ticketHasWorkAccepted,
} from './create-vote.helpers';

export type CreateVoteTargetType =
  | 'publication'
  | 'vote'
  | 'document-variant'
  | 'document-block-official';

export type CreateVoteInput = {
  targetType: CreateVoteTargetType;
  targetId: string;
  quotaAmount?: number;
  walletAmount?: number;
  direction?: 'up' | 'down';
  comment?: string;
  images?: string[];
};

export type CreateVoteResult = {
  id: string;
  targetType: string;
  targetId: string;
  userId: string;
  direction: 'up' | 'down';
  amountQuota: number;
  amountWallet: number;
  communityId: string;
  comment: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateVoteUseCaseDeps = {
  userId: string;
  publicationService: PublicationService;
  documentService: DocumentService;
  documentVariantService: DocumentVariantService;
  permissionService: PermissionService;
  voteService: VoteService;
  communityService: CommunityService;
  connection: Connection;
  walletContextResolverService: WalletContextResolverService;
  walletService: WalletService;
  userService: UserService;
  userCommunityRoleService: UserCommunityRoleService;
};


export class CreateVoteUseCase {
  constructor(private readonly deps: Omit<CreateVoteUseCaseDeps, 'userId'>) {}

  async execute(input: CreateVoteInput & { userId: string }): Promise<CreateVoteResult> {
    const { userId } = input;
    const deps = this.deps;
      let publicationDoc: Awaited<
        ReturnType<typeof deps.publicationService.getPublicationDocument>
      > | null = null;
    
      let documentVoteCtx: Awaited<ReturnType<typeof resolveDocumentVoteContext>> | undefined;
    
      if (isDocumentVoteTargetType(input.targetType)) {
        documentVoteCtx = await resolveDocumentVoteContext(
          deps.documentService,
          async (documentId, blockId) => {
            const variants = await deps.documentVariantService.listByBlock(documentId, blockId);
            return variants.some((v: DocumentBlockVariantSchemaClass) => v.status === 'open');
          },
          input.targetType,
          input.targetId,
        );
      } else if (input.targetType === 'publication') {
        publicationDoc = await deps.publicationService.getPublicationDocument(
          input.targetId,
        );
      }
    
      if (publicationDoc?.postType === 'event') {
        throw new BadRequestException('Event publications cannot be voted on');
      }
    
      const requestedQuotaEarly = input.quotaAmount ?? 0;
      const requestedWalletEarly = input.walletAmount ?? 0;
      const requestedTotalEarly = requestedQuotaEarly + requestedWalletEarly;
    
      // Personal author / Birzha source-manager top-up: not a normal vote; allow without canVote.
      if (input.targetType === 'publication') {
        const isPersonalAuthorTopUp =
          !!publicationDoc &&
          publicationDoc.authorId === userId &&
          !isPublicationEntitySourced(publicationDoc);
        const bypassCanVoteForTopUp =
          requestedTotalEarly > 0 &&
          !!publicationDoc &&
          (isPersonalAuthorTopUp ||
            (await deps.permissionService.isUserManagingBirzhaSourcePost(
              userId,
              input.targetId,
            )));
        if (!bypassCanVoteForTopUp) {
          const canVote = await deps.permissionService.canVote(userId, input.targetId);
          if (!canVote) {
            throw new ForbiddenException('You do not have permission to vote on this publication');
          }
        }
      } else if (input.targetType === 'vote') {
        const canVote = await deps.permissionService.canVoteOnVote(userId, input.targetId);
        if (!canVote) {
          throw new ForbiddenException('You do not have permission to vote on this comment');
        }
      } else if (isDocumentVoteTargetType(input.targetType)) {
        const canVote =
          input.targetType === 'document-variant'
            ? await deps.permissionService.canVoteOnDocumentVariant(userId, input.targetId)
            : await deps.permissionService.canVoteOnDocumentBlockOfficial(
                userId,
                documentVoteCtx!.doc.id,
                documentVoteCtx!.blockId,
              );
        if (!canVote) {
          throw new ForbiddenException('You do not have permission to vote on this document variant');
        }
      }
    
      // Get communityId from target
      const communityId = await getCommunityIdFromTarget(
        input.targetType,
        input.targetId,
        deps.publicationService,
        deps.voteService,
        deps.documentService,
      );
    
      // Get community
      const community = await deps.communityService.getCommunity(communityId);
      if (!community) {
        throw new NotFoundException('Community not found');
      }
    
      if (documentVoteCtx) {
        const documentsMode =
          community.settings?.documentsMode ?? 'visionOrDescriptionOnly';
        if (documentsMode === 'off') {
          throw new BadRequestException('Collaborative documents are disabled in this community');
        }
        if (
          !deps.documentService.isDocumentBlockVotingOpen(
            documentVoteCtx.doc,
            documentVoteCtx.blockId,
          )
        ) {
          throw new BadRequestException('Voting for this document block wave has ended');
        }
      }
    
      const isTicketPublication = publicationDoc?.postType === 'ticket';
    
      // Validate amounts
      const requestedQuotaAmount = input.quotaAmount ?? 0;
      const requestedWalletAmount = input.walletAmount ?? 0;
      const requestedTotalAmount = requestedQuotaAmount + requestedWalletAmount;
    
      // Author top-up: when post author adds merits to their own post (direct top-up to rating),
      // this bypasses commentMode — it is not a vote/comment, just a transfer.
      let isAuthorTopup = false;
      if (input.targetType === 'publication' && requestedTotalAmount > 0) {
        if (
          publicationDoc &&
          publicationDoc.authorId === userId &&
          !isPublicationEntitySourced(publicationDoc)
        ) {
          isAuthorTopup = true;
        }
        if (
          !isAuthorTopup &&
          publicationDoc &&
          (await deps.permissionService.isUserManagingBirzhaSourcePost(
            userId,
            input.targetId,
          ))
        ) {
          isAuthorTopup = true;
        }
        if ((publicationDoc?.status ?? 'active') === 'closed') {
          throw new BadRequestException('This post is closed and cannot be modified');
        }
      }
    
      if (requestedTotalAmount < 0) {
        throw new BadRequestException('Vote amount cannot be negative');
      }
    
      if (isTicketPublication && requestedTotalAmount > 0) {
        const allowTicketMerits =
          community.isProject === true &&
          publicationDoc?.ticketStatus === 'closed' &&
          ticketHasWorkAccepted(publicationDoc);
        if (!allowTicketMerits) {
          throw new BadRequestException('Task posts only accept free text comments (no merits)');
        }
      }
    
      // commentMode validation: which comment/vote types are allowed in this community
      // Skip for author top-up — author adding merits to own post is direct transfer, not a vote
      if (!isAuthorTopup) {
        const commentMode =
          community.settings?.commentMode ??
          (community.settings?.tappalkaOnlyMode ? 'neutralOnly' : 'all');
        if (commentMode === 'neutralOnly' && requestedTotalAmount !== 0) {
          throw new BadRequestException('This community only allows neutral comments');
        }
        if (
          commentMode === 'weightedOnly' &&
          requestedTotalAmount === 0 &&
          !isTicketPublication
        ) {
          throw new BadRequestException('This community requires comments to have merit weight');
        }
        // commentMode "all": allow text-only neutral comments (zero quota + zero wallet).
        if (
          requestedTotalAmount === 0 &&
          commentMode === 'all' &&
          !isTicketPublication &&
          !input.comment?.trim()
        ) {
          throw new BadRequestException('Comment text is required for neutral comments');
        }
        if (
          requestedTotalAmount === 0 &&
          commentMode !== 'neutralOnly' &&
          commentMode !== 'all' &&
          !isTicketPublication
        ) {
          throw new BadRequestException('At least one of quotaAmount or walletAmount must be greater than zero');
        }
        if (isTicketPublication && requestedTotalAmount === 0 && !input.comment?.trim()) {
          throw new BadRequestException('Comment text is required for task comments');
        }
      }
    
      // Determine direction
      // Default to "up" when not specified. Downvotes must be explicit.
      const direction: 'up' | 'down' = input.direction ?? 'up';
    
      if (isDocumentVoteTargetType(input.targetType) && !input.comment?.trim()) {
        throw new BadRequestException('Comment is required when voting on document variants');
      }
    
      // Future Vision (OB): wallet-only on posts/comments; comment required for weighted votes
      if (
        community?.typeTag === 'future-vision' &&
        (input.targetType === 'publication' || input.targetType === 'vote')
      ) {
        if (!input.comment?.trim()) {
          throw new BadRequestException('Comment is required in Future Vision');
        }
      }
    
      // Community-level setting: allow/disallow negative (down) votes.
      if (direction === 'down' && community?.votingSettings?.allowNegativeVoting === false) {
        throw new ForbiddenException('Downvotes are disabled in this community');
      }
    
      if (
        isDocumentVoteTargetType(input.targetType) &&
        direction === 'down' &&
        documentVoteCtx &&
        documentVoteCtx.doc.allowDownvotes === false
      ) {
        throw new ForbiddenException('Downvotes are disabled for this document');
      }
    
      // Role-specific and community-specific voting rules should be enforced BEFORE balance/quota checks
      // so we don't mask the real reason with "Insufficient quota/balance" errors.
      const _userRole = await deps.permissionService.getUserRoleInCommunity(
        userId,
        communityId,
      );
    
      // Effective currencySource (DB + typeTag defaults, e.g. project quota-and-wallet)
      const currencySource = deps.communityService.getEffectiveVotingSettings(community)
        .currencySource;
    
      // Note: viewer role removed - all users are now participants
      // With global merit, Marathon uses global wallet (quota disabled in MVP). No quota-only restriction.
    
      // Backward compatibility: Special case: Future Vision blocks quota voting (wallet only) for posts/comments (if currencySource not set).
      if (
        (input.targetType === 'publication' ||
          input.targetType === 'vote' ||
          isDocumentVoteTargetType(input.targetType)) &&
        community?.typeTag === 'future-vision' &&
        !currencySource &&
        requestedQuotaAmount > 0
      ) {
        throw new BadRequestException('Future Vision only allows wallet voting on posts and comments. Please use wallet merits to vote.');
      }
    
      // Default rule: both quota and wallet voting are allowed in all other communities.
    
      // Validate quota cannot be used for downvotes
      if (direction === 'down' && requestedQuotaAmount > 0) {
        throw new BadRequestException('Quota cannot be used for downvotes');
      }
    
      // Auto-split for upvotes: quota first, then wallet.
      // Keeps runtime behavior consistent regardless of client-provided split.
      let quotaAmount = requestedQuotaAmount;
      let walletAmount = requestedWalletAmount;
      if (
        direction === 'up' &&
        !isAuthorTopup &&
        requestedTotalAmount > 0
      ) {
        const effectiveMeritSettings = deps.communityService.getEffectiveMeritSettings(
          community,
        );
        const quotaRecipients = effectiveMeritSettings?.quotaRecipients ?? [];
        const canUseQuotaByRole = _userRole ? quotaRecipients.includes(_userRole) : true;
        const quotaEnabled = effectiveMeritSettings?.quotaEnabled !== false;
        const quotaAllowedByCurrency = currencySource !== 'wallet-only';
        let canUseQuota = quotaEnabled && canUseQuotaByRole && quotaAllowedByCurrency;

        // Self-vote: wallet only — must match VoteService / SocialCurrencyConstraintFactor
        if (
          canUseQuota &&
          input.targetType === 'document-variant' &&
          documentVoteCtx?.variant?.proposedBy === userId
        ) {
          canUseQuota = false;
        }
        if (
          canUseQuota &&
          input.targetType === 'publication' &&
          publicationDoc &&
          publicationDoc.authorId === userId &&
          !isPublicationEntitySourced(publicationDoc)
        ) {
          canUseQuota = false;
        }

        let remainingQuota = 0;
        if (canUseQuota) {
          remainingQuota = await getRemainingQuota(
            userId,
            communityId,
            community,
            deps.communityService,
            deps.connection,
          );
        }
    
        quotaAmount = Math.min(requestedTotalAmount, remainingQuota);
        walletAmount = requestedTotalAmount - quotaAmount;
    
        if (currencySource === 'quota-only' && walletAmount > 0) {
          throw new BadRequestException(`Insufficient quota. Available: ${remainingQuota}, Requested: ${requestedTotalAmount}`);
        }
      }
    
      // Check quota availability
      if (quotaAmount > 0) {
        const remainingQuota = await getRemainingQuota(
          userId,
          communityId,
          community,
          deps.communityService,
          deps.connection,
        );
    
        if (quotaAmount > remainingQuota) {
          throw new BadRequestException(`Insufficient quota. Available: ${remainingQuota}, Requested: ${quotaAmount}`);
        }
      }
    
      // Check wallet balance (global for priority communities, community for local)
      const walletCommunityId =
        await deps.walletContextResolverService.resolvePersonalWalletCommunityId(
          community,
          'voting',
        );
      if (walletAmount > 0) {
        const walletBalance = await getWalletBalance(
          userId,
          walletCommunityId,
          deps.walletService,
        );
    
        if (walletAmount > walletBalance) {
          throw new BadRequestException(`Insufficient wallet balance. Available: ${walletBalance}, Requested: ${walletAmount}`);
        }
      }
    
      const totalMeritVoteAmount = quotaAmount + walletAmount;
      const useProjectInstantAppreciation =
        input.targetType === 'publication' &&
        shouldUseProjectInstantAppreciation(
          community,
          publicationDoc,
          direction,
          totalMeritVoteAmount,
        );
    
      if (community.isProject === true && totalMeritVoteAmount > 0) {
        const actor = await deps.userService.getUserById(userId);
        const isSuperadmin = actor?.globalRole === 'superadmin';
        if (!isSuperadmin) {
          const memberRole = await deps.userCommunityRoleService.getRole(
            userId,
            communityId,
          );
          if (isDocumentVoteTargetType(input.targetType)) {
            if (!memberRole) {
              throw new ForbiddenException('Only project members can vote with merits in this project');
            }
          } else {
            const allowNonMemberMerit =
              publicationDoc &&
              (publicationDoc.postType === 'discussion' ||
                (publicationDoc.postType === 'ticket' &&
                  publicationDoc.ticketStatus === 'closed' &&
                  ticketHasWorkAccepted(publicationDoc)));
            if (!memberRole && !allowNonMemberMerit) {
              throw new ForbiddenException('Only project members can vote with merits in this project');
            }
          }
        }
      }
    
      // Create vote (document-variant rating is updated in the same transaction)
      let vote: Awaited<ReturnType<typeof deps.voteService.createVote>>;
      if (isDocumentVoteTargetType(input.targetType)) {
        const documentVoteTargetType: DocumentVoteTargetType = input.targetType;
        const totalAmount = quotaAmount + walletAmount;
        const delta = direction === 'up' ? totalAmount : -totalAmount;
        const session = await deps.connection.startSession();
        try {
          await session.withTransaction(async () => {
            vote = await deps.voteService.createVote(
              userId,
              documentVoteTargetType,
              input.targetId,
              quotaAmount,
              walletAmount,
              direction,
              input.comment || '',
              communityId,
              input.images,
              session,
            );
            await applyDocumentVoteRatingDelta(
              deps.documentService,
              documentVoteTargetType,
              input.targetId,
              delta,
              session,
            );
          });
        } finally {
          await session.endSession();
        }
      } else {
        vote = await deps.voteService.createVote(
          userId,
          input.targetType,
          input.targetId,
          quotaAmount,
          walletAmount,
          direction,
          input.comment || '',
          communityId,
          input.images,
        );
      }
    
      // Update publication metrics if voting on a publication.
      // Project instant appreciation: credit beneficiary wallet AND update publication metrics (rating UI / lists).
      if (input.targetType === 'publication') {
        const totalAmount = quotaAmount + walletAmount;
        if (useProjectInstantAppreciation && publicationDoc) {
          const beneficiaryId =
            publicationDoc.postType === 'ticket'
              ? (publicationDoc.beneficiaryId ?? publicationDoc.authorId)
              : publicationDoc.authorId;
          const currency = community.settings?.currencyNames || {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          };
          const appreciationWalletCommunityId =
            await deps.walletContextResolverService.resolvePersonalWalletCommunityId(
              community,
              'voting',
            );
          await deps.walletService.addTransaction(
            beneficiaryId,
            appreciationWalletCommunityId,
            'credit',
            totalAmount,
            'personal',
            'project_appreciation',
            input.targetId,
            currency,
            `Project appreciation for publication ${input.targetId}`,
          );
          await deps.publicationService.voteOnPublication(
            input.targetId,
            userId,
            totalAmount,
            direction,
          );
        } else {
          await deps.publicationService.voteOnPublication(
            input.targetId,
            userId,
            totalAmount,
            direction,
          );
        }
      }
    
      // Deduct from wallet if wallet amount was used (global for priority, community for local)
      if (walletAmount > 0) {
        const transactionType =
          input.targetType === 'publication'
            ? 'publication_vote'
            : input.targetType === 'vote'
              ? 'vote_vote'
              : 'document_variant_vote';
        const targetCommunity =
          walletCommunityId === GLOBAL_COMMUNITY_ID
            ? await deps.communityService.getCommunity(GLOBAL_COMMUNITY_ID)
            : community;
        const currency = targetCommunity?.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        await deps.walletService.addTransaction(
          userId,
          walletCommunityId,
          'debit',
          walletAmount,
          'personal',
          transactionType,
          input.targetId,
          currency,
          `Vote on ${input.targetType} ${input.targetId}`,
        );
      }
    
      // Return vote as plain object (Vote is a Mongoose document, not an entity)
      return {
        id: vote.id,
        targetType: vote.targetType,
        targetId: vote.targetId,
        userId: vote.userId,
        direction: vote.direction,
        amountQuota: vote.amountQuota,
        amountWallet: vote.amountWallet,
        communityId: vote.communityId,
        comment: vote.comment,
        images: vote.images || [],
        createdAt: vote.createdAt.toISOString(),
        updatedAt: vote.updatedAt?.toISOString() || vote.createdAt.toISOString(),
      };
  }
}

export function createCreateVoteUseCase(
  deps: Omit<CreateVoteUseCaseDeps, 'userId'>,
): CreateVoteUseCase {
  return new CreateVoteUseCase(deps);
}

export function createCreateVoteUseCaseFromContext(ctx: {
  publicationService: PublicationService;
  documentService: DocumentService;
  documentVariantService: DocumentVariantService;
  permissionService: PermissionService;
  voteService: VoteService;
  communityService: CommunityService;
  connection: Connection;
  walletContextResolverService: WalletContextResolverService;
  walletService: WalletService;
  userService: UserService;
  userCommunityRoleService: UserCommunityRoleService;
}): CreateVoteUseCase {
  return createCreateVoteUseCase({
    publicationService: ctx.publicationService,
    documentService: ctx.documentService,
    documentVariantService: ctx.documentVariantService,
    permissionService: ctx.permissionService,
    voteService: ctx.voteService,
    communityService: ctx.communityService,
    connection: ctx.connection,
    walletContextResolverService: ctx.walletContextResolverService,
    walletService: ctx.walletService,
    userService: ctx.userService,
    userCommunityRoleService: ctx.userCommunityRoleService,
  });
}
