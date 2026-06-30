import { TRPCError } from '@trpc/server';
import { NotFoundError } from '../../../common/exceptions/api.exceptions';
import type { PermissionService } from '../../../domain/services/permission.service';
import type {
  PostClosingService,
  PostCloseReason,
} from '../../../domain/services/post-closing.service';
import { resolveManualCloseReason } from '../../../domain/services/post-closing.service';
import type { PublicationClosingSummary } from '../../../domain/models/publication/publication.schema';
import type { PublicationService } from '../../../domain/services/publication.service';

export type ClosePublicationContext = {
  user: { id: string };
  publicationService: PublicationService;
  permissionService: PermissionService;
  postClosingService: PostClosingService;
};

export type ClosePublicationInput = {
  publicationId: string;
};

export type ClosePublicationResult = {
  closingSummary: PublicationClosingSummary;
};

/**
 * BC-03: manual post closing orchestration.
 * inv-04: rejects when post is not active (closed posts remain archived, not re-closed).
 * Preserves negative-rating manual close via closeReason derived from current score.
 */
export class ClosePublicationUseCase {
  constructor(private readonly ctx: ClosePublicationContext) {}

  async execute(input: ClosePublicationInput): Promise<ClosePublicationResult> {
    const publication = await this.ctx.publicationService.getPublication(
      input.publicationId,
    );
    if (!publication) {
      throw new NotFoundError('Publication', input.publicationId);
    }

    const beneficiaryId = publication.getEffectiveBeneficiary().getValue();
    const canManageSource =
      await this.ctx.permissionService.isUserManagingBirzhaSourcePost(
        this.ctx.user.id,
        input.publicationId,
      );
    if (beneficiaryId !== this.ctx.user.id && !canManageSource) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the post author can close this post',
      });
    }

    const doc = await this.ctx.publicationService.getPublicationDocument(
      input.publicationId,
    );
    const status = doc?.status ?? 'active';
    if (status !== 'active') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This post is closed and cannot be modified',
      });
    }

    const closeReason: PostCloseReason = resolveManualCloseReason(
      publication.getMetrics.score,
    );
    const result = await this.ctx.postClosingService.closePost(
      input.publicationId,
      closeReason,
    );

    return { closingSummary: result.closingSummary };
  }
}

export function createClosePublicationUseCase(
  ctx: ClosePublicationContext,
): ClosePublicationUseCase {
  return new ClosePublicationUseCase(ctx);
}
