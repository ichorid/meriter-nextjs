import { Logger } from '@nestjs/common';
import type { Community } from '../../../domain/models/community/community.schema';
import type { DocumentBlockVariantSchemaClass } from '../../../domain/models/document-block-variant/document-block-variant.schema';
import type { MeriterDocumentSchemaClass } from '../../../domain/models/meriter-document/meriter-document.schema';
import type { DocumentPersistencePort } from '../../../domain/ports/document.persistence.port';
import type { CommunityService } from '../../../domain/services/community.service';
import type { DocumentLiveUpdatesService } from '../../../domain/services/document-live-updates.service';
import type { DocumentService } from '../../../domain/services/document.service';
import type { NotificationService } from '../../../domain/services/notification.service';
import type { FinalizeDocumentWavePort } from '../../../domain/ports/finalize-document-wave.port';
import { resolveVariantRangeBounds } from '../../../domain/common/document-range.util';
import { rangesOverlap } from '../../../domain/common/document-plain-text.util';
import {
  documentVotingThreadFinalizeLockId,
} from '../../../domain/common/constants/document-wave-lock.constants';
import type { DocumentVotingThreadRecord } from '../../../domain/ports/document.persistence.port';
export type FinalizeDocumentWaveDeps = {
  documentService: DocumentService;
  documentPersistence: DocumentPersistencePort;
  communityService: CommunityService;
  notificationService: NotificationService;
  /** Applies closed-winner in auto mode (inv-15 mirror stays in DocumentVariantService). */
  autoApplyWinner: (documentId: string, blockId: string) => Promise<void>;
  /** Applies single thread winner in auto mode (v3 one winner per thread). */
  autoApplyThreadWinner: (documentId: string, variantId: string) => Promise<void>;
  documentLiveUpdates: DocumentLiveUpdatesService;
};

/**
 * BC-06: periodic and on-demand voting-wave finalization (§12.2).
 * Cron and propose/close paths delegate here via DocumentVariantService.
 */
export class FinalizeDocumentWaveUseCase implements FinalizeDocumentWavePort {
  private readonly logger = new Logger(FinalizeDocumentWaveUseCase.name);

  constructor(private readonly deps: FinalizeDocumentWaveDeps) {}

  /** Periodic sweep invoked by document-wave cron. */
  async execute(): Promise<void> {
    const expiredThreads = await this.deps.documentPersistence.findExpiredOpenVotingThreads();
    for (const thread of expiredThreads) {
      try {
        await this.finalizeThread(thread);
      } catch (err) {
        this.logger.warn(
          `Thread wave sweep failed ${thread.documentId}/${thread.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const pairs = await this.deps.documentPersistence.findOpenWaveBlockPairs();

    for (const p of pairs) {
      const documentId = p.documentId;
      const blockId = p.blockId;
      try {
        const doc = await this.deps.documentService.getById(documentId);
        if (!doc) {
          continue;
        }
        const openOnBlock = await this.deps.documentPersistence.findOpenVariants(
          documentId,
          blockId,
        );
        if (
          openOnBlock.length > 0 &&
          openOnBlock.every((v) => v.votingThreadId)
        ) {
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

  async finalizeThread(
    thread: DocumentVotingThreadRecord,
    options?: { force?: boolean },
  ): Promise<void> {
    const lockId = documentVotingThreadFinalizeLockId(thread.documentId, thread.id);
    const acquired = await this.deps.documentPersistence.acquireWaveFinalizeLock(
      thread.documentId,
      lockId,
    );
    if (!acquired) {
      return;
    }
    try {
      await this.finalizeThreadCore(thread, options);
    } finally {
      await this.deps.documentPersistence.releaseWaveFinalizeLock(
        thread.documentId,
        lockId,
      );
    }
  }

  private async finalizeThreadCore(
    thread: DocumentVotingThreadRecord,
    options?: { force?: boolean },
  ): Promise<void> {
    const doc = await this.deps.documentService.getById(thread.documentId);
    if (!doc) {
      return;
    }
    if (
      !options?.force &&
      new Date(thread.waveEndsAt).getTime() > Date.now()
    ) {
      return;
    }

    const openVariants = await this.deps.documentPersistence.findOpenVariantsByVotingThreadId(
      thread.id,
    );
    if (openVariants.length === 0) {
      await this.deps.documentPersistence.updateVotingThread(thread.id, {
        status: 'closed',
      });
      return;
    }

    openVariants.sort((a, b) => {
      if ((b.rating ?? 0) !== (a.rating ?? 0)) {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      return new Date(a.proposedAt).getTime() - new Date(b.proposedAt).getTime();
    });

    const winner = openVariants[0]!;
    const hasPositiveWinner = (winner.rating ?? 0) > 0;

    for (const v of openVariants) {
      const isWinner = hasPositiveWinner && v.id === winner.id;
      await this.deps.documentPersistence.updateVariantStatus(
        v.id,
        isWinner ? 'closed-winner' : 'closed-not-winner',
      );
    }

    const touchedBlockIds = new Set(openVariants.map((v) => v.blockId));
    for (const blockId of touchedBlockIds) {
      await this.deps.documentService.updateDocumentBlock(thread.documentId, blockId, (b) => {
        delete b.currentWaveStartedAt;
        b.officialRating = 0;
      });
    }

    await this.deps.documentPersistence.updateVotingThread(thread.id, { status: 'closed' });

    const community = await this.deps.communityService.getCommunity(doc.communityId);
    if (community) {
      await notifyVariantsNotSelected(this.deps, {
        doc,
        community,
        blockId: thread.anchorBlockId,
        variants: openVariants,
        winnerVariantId: hasPositiveWinner ? winner.id : undefined,
        reason: hasPositiveWinner ? 'other_variant_won' : 'no_positive_winner',
      }).catch((err) => {
        this.logger.warn(
          `Failed to notify thread variant outcome ${thread.documentId}/${thread.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }

    if (hasPositiveWinner) {
      await notifyVariantWon(
        this.deps,
        winner as DocumentBlockVariantSchemaClass,
        doc,
      ).catch((err) => {
        this.logger.warn(
          `Failed to notify thread winner ${winner.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
      await this.deps.autoApplyThreadWinner(thread.documentId, winner.id);
    }

    this.deps.documentLiveUpdates.publish({
      type: 'wave.closed',
      documentId: doc.id,
      documentUpdatedAt: doc.updatedAt,
      blockId: thread.anchorBlockId,
    });
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

    if (
      openVariants.length > 0 &&
      openVariants.every((v) => v.votingThreadId)
    ) {
      return;
    }

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
      this.emitWaveClosed(docLean, blockId);
      return;
    }

    const officialHtml = String(block?.officialContent ?? '');
    const winners = pickNonOverlappingWinners(openVariants, officialHtml);
    const winnerIds = new Set(winners.map((w) => w.id));

    for (const v of openVariants) {
      const isWinner = winnerIds.has(v.id);
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
      const primaryWinner = winners[0];
      await notifyVariantsNotSelected(this.deps, {
        doc: docLean,
        community,
        blockId,
        variants: openVariants,
        winnerVariantId: primaryWinner?.id,
        reason:
          winners.length > 0 ? 'other_variant_won' : 'no_positive_winner',
      }).catch((err) => {
        this.logger.warn(
          `Failed to notify variant non-selection ${documentId}/${blockId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }

    for (const winner of winners) {
      await notifyVariantWon(this.deps, winner, docLean).catch((err) => {
        this.logger.warn(
          `Failed to notify variant winner ${winner.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }

    await this.deps.autoApplyWinner(documentId, blockId);
    this.emitWaveClosed(docLean, blockId);
  }

  private emitWaveClosed(doc: MeriterDocumentSchemaClass, blockId: string): void {
    this.deps.documentLiveUpdates.publish({
      type: 'wave.closed',
      documentId: doc.id,
      documentUpdatedAt: doc.updatedAt,
      blockId,
    });
  }
}

export function createFinalizeDocumentWaveUseCase(
  deps: FinalizeDocumentWaveDeps,
): FinalizeDocumentWaveUseCase {
  return new FinalizeDocumentWaveUseCase(deps);
}

function pickNonOverlappingWinners(
  openVariants: DocumentBlockVariantSchemaClass[],
  officialHtml: string,
): DocumentBlockVariantSchemaClass[] {
  const sorted = [...openVariants].sort((a, b) => {
    if ((b.rating ?? 0) !== (a.rating ?? 0)) {
      return (b.rating ?? 0) - (a.rating ?? 0);
    }
    return new Date(a.proposedAt).getTime() - new Date(b.proposedAt).getTime();
  });

  const winners: DocumentBlockVariantSchemaClass[] = [];
  const winnerBounds: Array<{ start: number; end: number }> = [];

  for (const variant of sorted) {
    if ((variant.rating ?? 0) <= 0) {
      continue;
    }
    const bounds = resolveVariantRangeBounds(variant, officialHtml);
    const overlapsWinner = winnerBounds.some((w) =>
      rangesOverlap(bounds.rangeStart, bounds.rangeEnd, w.start, w.end),
    );
    if (!overlapsWinner) {
      winners.push(variant);
      winnerBounds.push({ start: bounds.rangeStart, end: bounds.rangeEnd });
    }
  }

  return winners;
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
