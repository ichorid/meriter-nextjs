import { Logger } from '@nestjs/common';
import type { Community } from '../../../domain/models/community/community.schema';
import type { DocumentBlockVariantSchemaClass } from '../../../domain/models/document-block-variant/document-block-variant.schema';
import type { MeriterDocumentSchemaClass } from '../../../domain/models/meriter-document/meriter-document.schema';
import type { DocumentPersistencePort } from '../../../domain/ports/document.persistence.port';
import type { CommunityService } from '../../../domain/services/community.service';
import type { DocumentService } from '../../../domain/services/document.service';
import type { NotificationService } from '../../../domain/services/notification.service';
export type FinalizeDocumentWaveDeps = {
  documentService: DocumentService;
  documentPersistence: DocumentPersistencePort;
  communityService: CommunityService;
  notificationService: NotificationService;
  /** Applies closed-winner in auto mode (inv-15 mirror stays in DocumentVariantService). */
  autoApplyWinner: (documentId: string, blockId: string) => Promise<void>;
};

/**
 * BC-06: periodic and on-demand voting-wave finalization (§12.2).
 * Cron and propose/close paths delegate here via DocumentVariantService.
 */
export class FinalizeDocumentWaveUseCase {
  private readonly logger = new Logger(FinalizeDocumentWaveUseCase.name);

  constructor(private readonly deps: FinalizeDocumentWaveDeps) {}

  /** Periodic sweep invoked by document-wave cron. */
  async execute(): Promise<void> {
    const pairs = await this.deps.documentPersistence.findOpenWaveBlockPairs();

    for (const p of pairs) {
      const documentId = p.documentId;
      const blockId = p.blockId;
      try {
        const doc = await this.deps.documentService.getById(documentId);
        if (!doc) {
          continue;
        }
        if (this.deps.documentService.isDocumentBlockVotingOpen(doc, blockId)) {
          continue;
        }
        await this.finalizeBlock(documentId, blockId);
      } catch (err) {
        this.logger.warn(
          `Wave sweep failed ${documentId}/${blockId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * When wave time elapsed: pick winner, reset wave anchor on block.
   * For `document.mode === 'auto'`, applies winning variant via autoApplyWinner (§12.2).
   */
  async finalizeBlock(
    documentId: string,
    blockId: string,
    options?: { force?: boolean },
  ): Promise<void> {
    const acquired = await this.deps.documentPersistence.acquireWaveFinalizeLock(
      documentId,
      blockId,
    );
    if (!acquired) {
      return;
    }
    try {
      await this.finalizeBlockCore(documentId, blockId, options);
    } finally {
      await this.deps.documentPersistence.releaseWaveFinalizeLock(documentId, blockId);
    }
  }

  private async finalizeBlockCore(
    documentId: string,
    blockId: string,
    options?: { force?: boolean },
  ): Promise<void> {
    const docLean = await this.deps.documentService.getById(documentId);
    if (!docLean) {
      return;
    }
    if (
      !options?.force &&
      this.deps.documentService.isDocumentBlockVotingOpen(docLean, blockId)
    ) {
      return;
    }

    const openVariants = await this.deps.documentPersistence.findOpenVariants(
      documentId,
      blockId,
    );

    if (openVariants.length === 0) {
      await this.deps.documentService.updateDocumentBlock(documentId, blockId, (b) => {
        delete b.currentWaveStartedAt;
        b.officialRating = 0;
      });
      return;
    }

    openVariants.sort((a, b) => {
      if ((b.rating ?? 0) !== (a.rating ?? 0)) {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      const ta = new Date(a.proposedAt).getTime();
      const tb = new Date(b.proposedAt).getTime();
      return ta - tb;
    });

    const block = this.deps.documentService.findBlock(docLean, blockId);
    const officialRating = block?.officialRating ?? 0;
    const topVariant = openVariants[0]!;
    const topVariantRating = topVariant?.rating ?? 0;
    const officialWins =
      officialRating > topVariantRating ||
      (officialRating === topVariantRating && officialRating > 0);

    if (officialWins) {
      for (const v of openVariants) {
        await this.deps.documentPersistence.updateVariantStatus(v.id, 'closed-not-winner');
      }
      await this.deps.documentService.updateDocumentBlock(documentId, blockId, (b) => {
        delete b.currentWaveStartedAt;
        b.officialRating = 0;
      });
      const community = await this.deps.communityService.getCommunity(docLean.communityId);
      if (community) {
        await notifyVariantsNotSelected(this.deps, {
          doc: docLean,
          community,
          blockId,
          variants: openVariants,
          reason: 'official_kept',
        }).catch((err) => {
          this.logger.warn(
            `Failed to notify variant non-selection (official kept) ${documentId}/${blockId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
      }
      return;
    }

    const top = topVariant;
    const topRated = topVariantRating > 0;

    for (const v of openVariants) {
      const isWinner = topRated && v.id === top.id;
      await this.deps.documentPersistence.updateVariantStatus(
        v.id,
        isWinner ? 'closed-winner' : 'closed-not-winner',
      );
    }

    await this.deps.documentService.updateDocumentBlock(documentId, blockId, (b) => {
      delete b.currentWaveStartedAt;
      b.officialRating = 0;
    });

    const community = await this.deps.communityService.getCommunity(docLean.communityId);
    if (community) {
      await notifyVariantsNotSelected(this.deps, {
        doc: docLean,
        community,
        blockId,
        variants: openVariants,
        winnerVariantId: topRated ? top.id : undefined,
        reason: topRated ? 'other_variant_won' : 'no_positive_winner',
      }).catch((err) => {
        this.logger.warn(
          `Failed to notify variant non-selection ${documentId}/${blockId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }

    if (topRated && docLean.mode !== 'auto') {
      await notifyVariantWon(this.deps, top, docLean).catch((err) => {
        this.logger.warn(
          `Failed to notify variant winner ${top.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    await this.deps.autoApplyWinner(documentId, blockId);
  }
}

export function createFinalizeDocumentWaveUseCase(
  deps: FinalizeDocumentWaveDeps,
): FinalizeDocumentWaveUseCase {
  return new FinalizeDocumentWaveUseCase(deps);
}

function buildDocumentNotificationMetadata(
  doc: MeriterDocumentSchemaClass,
  community: Community,
  blockId: string,
): Record<string, unknown> {
  return {
    communityId: doc.communityId,
    communityName: community.name,
    documentId: doc.id,
    documentTitle: doc.title,
    blockId,
    inviteTargetIsProject: community.isProject === true,
  };
}

async function notifyVariantsNotSelected(
  deps: FinalizeDocumentWaveDeps,
  params: {
    doc: MeriterDocumentSchemaClass;
    community: Community;
    blockId: string;
    variants: Array<{ id: string; proposedBy: string }>;
    winnerVariantId?: string;
    reason: 'official_kept' | 'other_variant_won' | 'no_positive_winner';
    actorUserId?: string;
  },
): Promise<void> {
  const { doc, community, blockId, variants, winnerVariantId, reason, actorUserId } = params;
  if (variants.length === 0) {
    return;
  }

  const winner = winnerVariantId
    ? variants.find((variant) => variant.id === winnerVariantId)
    : null;
  const metadata = {
    ...buildDocumentNotificationMetadata(doc, community, blockId),
    reason,
    winnerVariantId,
  };
  const title = doc.title?.trim() || 'Document';
  const recipientIds = new Set<string>();
  for (const variant of variants) {
    if (!variant.proposedBy) {
      continue;
    }
    if (winner?.proposedBy && variant.proposedBy === winner.proposedBy) {
      continue;
    }
    if (actorUserId && variant.proposedBy === actorUserId) {
      continue;
    }
    recipientIds.add(variant.proposedBy);
  }

  if (recipientIds.size === 0) {
    return;
  }

  const message =
    reason === 'official_kept'
      ? `Voting ended on "${title}" and the official text stayed unchanged.`
      : reason === 'no_positive_winner'
        ? `Voting ended on "${title}" and no variant reached a positive result.`
        : `Voting ended on "${title}" and another variant was selected.`;

  for (const userId of recipientIds) {
    await deps.notificationService.createNotification({
      userId,
      type: 'document_variant_not_selected',
      source: 'system',
      ...(actorUserId ? { sourceId: actorUserId } : {}),
      metadata,
      title: 'Your variant was not selected',
      message,
    });
  }
}

async function notifyVariantWon(
  deps: FinalizeDocumentWaveDeps,
  variant: DocumentBlockVariantSchemaClass,
  doc: MeriterDocumentSchemaClass,
): Promise<void> {
  if (!variant.proposedBy) {
    return;
  }
  const community = await deps.communityService.getCommunity(doc.communityId);
  if (!community) {
    return;
  }
  const title = doc.title?.trim() || 'Document';
  await deps.notificationService.createNotification({
    userId: variant.proposedBy,
    type: 'document_variant_won',
    source: 'system',
    metadata: buildDocumentNotificationMetadata(doc, community, variant.blockId),
    title: 'Your variant won the vote',
    message: `Your proposed text won voting on "${title}".`,
  });
}
