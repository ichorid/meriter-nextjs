import { TRPCError } from '@trpc/server';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import type { CommunityService } from '../../../domain/services/community.service';
import type { NotificationService } from '../../../domain/services/notification.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';

export type ForwardPublicationContext = {
  user: { id: string };
  publicationService: PublicationService;
  communityService: CommunityService;
  permissionService: PermissionService;
  walletService: WalletService;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  notificationService: NotificationService;
};

export type ProposeForwardInput = {
  publicationId: string;
  targetCommunityId: string;
};

export type RejectForwardInput = {
  publicationId: string;
};

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

/**
 * BC-03: forward proposal and rejection orchestration.
 * inv-01: forward proposal cost debited from GLOBAL_COMMUNITY_ID wallet.
 */
export class ForwardPublicationUseCase {
  constructor(private readonly ctx: ForwardPublicationContext) {}

  async proposeForward(input: ProposeForwardInput): Promise<{ success: true }> {
    const userId = this.ctx.user.id;
    const { publicationId, targetCommunityId } = input;

    const publication = await this.ctx.publicationService.getPublication(publicationId);
    if (!publication) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Publication not found',
      });
    }

    const sourceCommunityId = publication.getCommunityId.getValue();
    const sourceCommunity = await this.ctx.communityService.getCommunity(sourceCommunityId);

    if (!sourceCommunity) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Source community not found',
      });
    }

    const postType = publication.getPostType;
    if (postType === 'poll') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot forward polls',
      });
    }
    if (postType === 'event') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot forward event publications',
      });
    }

    const userRole = await this.ctx.permissionService.getUserRoleInCommunity(
      userId,
      sourceCommunityId,
    );
    if (userRole === 'lead' || userRole === 'superadmin') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Leads should use the forward endpoint directly',
      });
    }

    if (sourceCommunity.typeTag !== 'team') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Forward proposals can only be made from team groups',
      });
    }

    const targetSupports = await this.ctx.permissionService.targetCommunitySupportsPostType(
      targetCommunityId,
      postType as 'basic' | 'project',
      userId,
    );
    if (!targetSupports) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Target community does not support this post type',
      });
    }

    const forwardCost = sourceCommunity.settings?.forwardCost ?? 1;
    if (forwardCost > 0) {
      const wallet = await this.ctx.walletService.getWallet(userId, GLOBAL_COMMUNITY_ID);
      const walletBalance = wallet ? wallet.getBalance() : 0;
      if (walletBalance < forwardCost) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient wallet merits. Required: ${forwardCost}, available: ${walletBalance}`,
        });
      }
    }

    if (forwardCost > 0) {
      try {
        const globalCommunity = await this.ctx.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
        const currency = globalCommunity?.settings?.currencyNames || DEFAULT_CURRENCY;
        await this.ctx.walletService.addTransaction(
          userId,
          GLOBAL_COMMUNITY_ID,
          'debit',
          forwardCost,
          'personal',
          'forward_proposal',
          publicationId,
          currency,
          'Payment for forwarding proposal',
        );
      } catch (_error) {
        // Don't fail the request if wallet deduction fails - proposal is already created
      }
    }

    await this.ctx.publicationService.updateForwardProposal(
      publicationId,
      targetCommunityId,
      userId,
    );

    const leadRoles = await this.ctx.userCommunityRoleService.getUsersByRole(
      sourceCommunityId,
      'lead',
    );

    const targetCommunity = await this.ctx.communityService.getCommunity(targetCommunityId);
    const proposer = await this.ctx.userService.getUser(userId);
    const proposerName = proposer?.displayName || 'Someone';

    for (const leadRole of leadRoles) {
      const leadId = leadRole.userId;
      await this.ctx.notificationService.createNotification({
        userId: leadId,
        type: 'forward_proposal',
        source: 'user',
        sourceId: userId,
        metadata: {
          publicationId,
          communityId: sourceCommunityId,
          forwardProposedBy: userId,
          forwardTargetCommunityId: targetCommunityId,
          targetCommunityName: targetCommunity?.name || targetCommunityId,
        },
        title: 'Forward proposal',
        message: `${proposerName} proposed to forward a post to ${targetCommunity?.name || targetCommunityId}`,
      });
    }

    return { success: true };
  }

  async rejectForward(input: RejectForwardInput): Promise<{ success: true }> {
    const userId = this.ctx.user.id;
    const { publicationId } = input;

    const publication = await this.ctx.publicationService.getPublication(publicationId);
    if (!publication) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Publication not found',
      });
    }

    const sourceCommunityId = publication.getCommunityId.getValue();

    const publicationDoc = await this.ctx.publicationService.getPublicationDocument(publicationId);
    if (!publicationDoc || publicationDoc.forwardStatus !== 'pending') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Publication is not pending forward approval',
      });
    }

    const userRole = await this.ctx.permissionService.getUserRoleInCommunity(
      userId,
      sourceCommunityId,
    );
    if (userRole !== 'lead' && userRole !== 'superadmin') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only leads can reject forward proposals',
      });
    }

    await this.ctx.publicationService.clearForwardProposal(publicationId);

    return { success: true };
  }
}

export function createForwardPublicationUseCase(
  ctx: ForwardPublicationContext,
): ForwardPublicationUseCase {
  return new ForwardPublicationUseCase(ctx);
}
