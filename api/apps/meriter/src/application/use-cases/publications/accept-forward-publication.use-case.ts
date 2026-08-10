import { TRPCError } from '@trpc/server';
import type { Connection } from 'mongoose';
import type { CommunityService } from '../../../domain/services/community.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { VoteService } from '../../../domain/services/vote.service';

export type AcceptForwardPublicationContext = {
  user: { id: string };
  publicationService: PublicationService;
  communityService: CommunityService;
  permissionService: PermissionService;
  voteService: VoteService;
  connection: Connection;
};

export type AcceptForwardPublicationInput = {
  publicationId: string;
  targetCommunityId: string;
};

/**
 * BC-03: lead forward / accept proposal orchestration.
 * inv-03: vote merits transfer only when source settings.forwardRule === 'project'.
 */
export class AcceptForwardPublicationUseCase {
  constructor(private readonly ctx: AcceptForwardPublicationContext) {}

  async execute(
    input: AcceptForwardPublicationInput,
  ): Promise<{ success: true; forwardedPublicationId: string }> {
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
    if (userRole !== 'lead' && userRole !== 'superadmin') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only leads can forward posts',
      });
    }

    const publicationDoc = await this.ctx.publicationService.getPublicationDocument(publicationId);
    const isPending = publicationDoc?.forwardStatus === 'pending';

    if (isPending && publicationDoc?.forwardTargetCommunityId !== targetCommunityId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Target community does not match the proposal',
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

    const forwardRule = sourceCommunity.settings?.forwardRule || 'standard';

    const originalAuthorId = publication.getAuthorId.getValue();
    const originalBeneficiaryId = publication.getBeneficiaryId?.getValue();

    const newPublication = await this.ctx.publicationService.createPublication(
      originalAuthorId,
      {
        communityId: targetCommunityId,
        content: publication.getContent,
        type: publication.getType,
        postType: postType as 'basic' | 'project',
        isProject: postType === 'project',
        title: (publicationDoc as any)?.title,
        description: (publicationDoc as any)?.description,
        hashtags: (publicationDoc as any)?.hashtags || [],
        images: (publicationDoc as any)?.images,
        videoUrl: (publicationDoc as any)?.videoUrl,
        beneficiaryId: originalBeneficiaryId,
        impactArea: (publicationDoc as any)?.impactArea,
        beneficiaries: (publicationDoc as any)?.beneficiaries,
        methods: (publicationDoc as any)?.methods,
        stage: (publicationDoc as any)?.stage,
        helpNeeded: (publicationDoc as any)?.helpNeeded,
      },
    );

    const newPublicationId = newPublication.getId.getValue();

    if (forwardRule === 'project') {
      const originalVotes = await this.ctx.voteService.getVotesOnPublication(publicationId);

      if (originalVotes.length > 0) {
        if (this.ctx.connection?.db) {
          await this.ctx.connection.db.collection('votes').updateMany(
            {
              targetType: 'publication',
              targetId: publicationId,
            },
            {
              $set: {
                targetId: newPublicationId,
                communityId: targetCommunityId,
                updatedAt: new Date(),
              },
            },
          );

          let totalScore = 0;
          for (const vote of originalVotes) {
            const voteAmount = (vote.amountQuota || 0) + (vote.amountWallet || 0);
            const voteDirection = vote.direction === 'up' ? 1 : -1;
            totalScore += voteAmount * voteDirection;
          }

          if (totalScore !== 0) {
            const newPub = await this.ctx.publicationService.getPublication(newPublicationId);
            if (newPub) {
              newPub.vote(totalScore);
              const updateOp: Record<string, unknown> = { $set: newPub.toSnapshot() };
              if (totalScore > 0) {
                updateOp.$inc = { lifetimeCredits: totalScore };
              }
              await this.ctx.connection.db.collection('publications').updateOne(
                { id: newPublicationId },
                updateOp,
              );
            }
          }
        }
      }

      await this.ctx.publicationService.deletePublication(publicationId, userId);
    } else {
      await this.ctx.publicationService.markAsForwarded(publicationId, targetCommunityId);
    }

    return { success: true, forwardedPublicationId: newPublicationId };
  }
}

export function createAcceptForwardPublicationUseCase(
  ctx: AcceptForwardPublicationContext,
): AcceptForwardPublicationUseCase {
  return new AcceptForwardPublicationUseCase(ctx);
}
