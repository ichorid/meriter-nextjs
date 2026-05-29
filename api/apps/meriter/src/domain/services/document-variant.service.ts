import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Community } from '../models/community/community.schema';
import { DocumentBlockVariantSchemaClass } from '../models/document-block-variant/document-block-variant.schema';
import {
  MeriterDocumentSchemaClass,
  MeriterDocType,
} from '../models/meriter-document/meriter-document.schema';
import {
  DOCUMENT_PERSISTENCE_PORT,
  type DocumentPersistencePort,
} from '../ports/document.persistence.port';
import {
  FINALIZE_DOCUMENT_WAVE_PORT,
  type FinalizeDocumentWavePort,
} from '../ports/finalize-document-wave.port';
import {
  PROPOSE_DOCUMENT_VARIANT_PORT,
  type ProposeDocumentVariantPort,
} from '../ports/propose-document-variant.port';
import { CommunityService } from './community.service';
import { DocumentService } from './document.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { MERITER_DOCUMENT_AUTO_APPLY_USER_ID } from '../common/constants/meriter-actors.constant';
import { sanitizeDocumentHtml } from '../../common/utils/sanitize-document-html';
import {
  type DocumentVariantReferenceInput,
} from '../common/document-variant-references.util';

export type { DocumentVariantReferenceInput };

const MAX_VARIANT_CONTENT = 5000;

@Injectable()
export class DocumentVariantService {
  private readonly logger = new Logger(DocumentVariantService.name);

  constructor(
    private readonly documentService: DocumentService,
    @Inject(DOCUMENT_PERSISTENCE_PORT)
    private readonly documentPersistence: DocumentPersistencePort,
    private readonly communityService: CommunityService,
    private readonly notificationService: NotificationService,
    private readonly permissionService: PermissionService,
    @Inject(FINALIZE_DOCUMENT_WAVE_PORT)
    private readonly finalizeDocumentWaveUseCase: FinalizeDocumentWavePort,
    @Inject(PROPOSE_DOCUMENT_VARIANT_PORT)
    private readonly proposeDocumentVariantUseCase: ProposeDocumentVariantPort,
  ) {}

  async listByBlock(documentId: string, blockId: string): Promise<DocumentBlockVariantSchemaClass[]> {
    const variants = await this.documentPersistence.findVariantsByBlock(documentId, blockId);
    return variants as DocumentBlockVariantSchemaClass[];
  }

  /**
   * When wave time elapsed: pick winner, reset wave anchor on block.
   * For `document.mode === 'auto'`, applies winning variant (§12.2).
   */
  async finalizeExpiredWaveOnBlock(
    documentId: string,
    blockId: string,
    options?: { force?: boolean },
  ): Promise<void> {
    return this.finalizeDocumentWaveUseCase.finalizeBlock(documentId, blockId, options);
  }

  

  /**
   * Cron / sweep: close expired waves on all blocks that still have open variants.
   */
  /** Delegates to FinalizeDocumentWaveUseCase (BC-06 / P-6); invoked by document-wave cron. */
  async runPeriodicWaveSweep(): Promise<void> {
    return this.finalizeDocumentWaveUseCase.execute();
  }

  /** Delegates to ProposeDocumentVariantUseCase (BC-06 / P-6). */
  async proposeVariant(
    userId: string,
    input: {
      documentId: string;
      blockId: string;
      content: string;
      references?: DocumentVariantReferenceInput[];
    },
  ): Promise<DocumentBlockVariantSchemaClass> {
    return this.proposeDocumentVariantUseCase.execute(userId, input);
  }

  async withdrawVariant(userId: string, variantId: string): Promise<void> {
    const v = await this.documentService.getVariantById(variantId);
    if (!v) {
      throw new NotFoundException('Variant not found');
    }
    if (v.proposedBy !== userId) {
      throw new ForbiddenException('You can only withdraw your own variant');
    }
    if (v.status !== 'open') {
      throw new BadRequestException('Only open variants can be withdrawn');
    }
    await this.documentPersistence.updateVariantStatus(variantId, 'withdrawn');
  }

  /** Apply voting winner (closed-winner) — document owner or community admin. */
  async applyOfficialVotingWinner(
    actorUserId: string,
    documentId: string,
    blockId: string,
  ): Promise<void> {
    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted) {
      throw new NotFoundException('Document not found');
    }

    await this.assertCanManageDocument(actorUserId, doc);

    if (doc.mode !== 'manual') {
      throw new BadRequestException('Manual apply is only for documents in manual mode');
    }

    if (this.documentService.isDocumentBlockVotingOpen(doc, blockId)) {
      throw new BadRequestException('Voting is still open on this block');
    }

    const pending = await this.documentPersistence.findVariantsPendingResolution(
      documentId,
      blockId,
    );

    if (pending.some((v) => v.status === 'open')) {
      throw new BadRequestException('Close voting before choosing a winner');
    }

    const hasResolvedWave =
      pending.some((v) => v.status === 'closed-winner') ||
      pending.some((v) => v.status === 'closed-not-winner');
    if (!hasResolvedWave) {
      throw new BadRequestException('No completed voting to finalize on this block');
    }

    const now = new Date();
    await this.documentPersistence.updateVariantsStatusByFilter(
      {
        documentId,
        blockId,
        deleted: false,
        status: { $in: ['closed-winner', 'closed-not-winner'] },
      },
      'withdrawn',
    );

    await this.documentService.updateDocumentBlock(documentId, blockId, (b) => {
      delete b.currentWaveStartedAt;
      b.officialRating = 0;
      this.documentService.appendBlockEditHistory(b, {
        changedAt: now,
        changedBy: actorUserId,
        reason: 'vote',
        previousContent: String(b.officialContent ?? ''),
      });
    });
  }

  /** Apply voting winner (closed-winner) — document owner or community admin. */
  async applyVotingWinner(actorUserId: string, variantId: string): Promise<void> {
    const v = await this.documentService.getVariantById(variantId);
    if (!v) {
      throw new NotFoundException('Variant not found');
    }
    if (v.status !== 'closed-winner') {
      throw new BadRequestException('Variant is not in closed-winner state');
    }

    const doc = await this.documentService.getById(v.documentId);
    if (!doc || doc.deleted) {
      throw new NotFoundException('Document not found');
    }
    if ((v.rating ?? 0) <= 0) {
      throw new BadRequestException('Winner has no positive rating');
    }

    await this.assertCanManageDocument(actorUserId, doc);

    if (doc.mode !== 'manual') {
      throw new BadRequestException('Manual apply is only for documents in manual mode');
    }

    await this.applyVariantToOfficial(actorUserId, v, doc, 'vote');
  }

  /** Apply an open variant by admin / document author (voluntary), bypassing vote outcome. */
  async applyOpenVariantAsAdmin(actorUserId: string, variantId: string): Promise<void> {
    const v = await this.documentService.getVariantById(variantId);
    if (!v) {
      throw new NotFoundException('Variant not found');
    }
    if (v.status !== 'open') {
      throw new BadRequestException('Only open variants can be applied by admin override');
    }

    const doc = await this.documentService.getById(v.documentId);
    if (!doc || doc.deleted) {
      throw new NotFoundException('Document not found');
    }

    await this.assertCanManageDocument(actorUserId, doc);

    await this.applyVariantToOfficial(actorUserId, v, doc, 'admin');
  }

  /** §12.3 — arbitrary official text without a variant (lead / document author). */
  async applyAdminOverride(
    actorUserId: string,
    documentId: string,
    blockId: string,
    newContent: string,
  ): Promise<void> {
    const content = sanitizeDocumentHtml(newContent);
    if (!content) {
      throw new BadRequestException('Official content is required');
    }
    if (content.length > MAX_VARIANT_CONTENT) {
      throw new BadRequestException(`Content must be at most ${MAX_VARIANT_CONTENT} characters`);
    }

    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted || doc.status !== 'active') {
      throw new NotFoundException('Document not found');
    }

    const community = await this.communityService.getCommunity(doc.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    this.assertDocumentsModeAllowsDocument(community, doc.type);
    await this.assertCanManageDocument(actorUserId, doc);

    const block = this.documentService.findBlock(doc, blockId);
    if (!block) {
      throw new NotFoundException('Block not found');
    }

    const openVariantsBeforeOverride = await this.documentPersistence.findOpenVariants(
      doc.id,
      blockId,
    );

    const now = new Date();
    const ok = await this.documentService.updateDocumentBlock(doc.id, blockId, (b) => {
      const previousContent = String(b.officialContent ?? '');
      this.documentService.appendBlockEditHistory(b, {
        changedAt: now,
        changedBy: actorUserId,
        reason: 'admin',
        previousContent,
      });
      b.officialContent = content;
      b.officialContentSetAt = now;
      b.officialContentSetBy = actorUserId;
      b.officialContentReason = 'admin';
      delete b.officialContentVariantId;
      delete b.currentWaveStartedAt;
    });
    if (!ok) {
      throw new BadRequestException('Failed to update block');
    }

    await this.documentPersistence.updateVariantsStatusByFilter(
      {
        documentId: doc.id,
        blockId,
        status: 'open',
        deleted: false,
      },
      'closed-not-winner',
    );

    await this.documentService.mirrorOfficialTextToCommunityIfApplicable(doc.id);

    await this.notifyBlockAdminOverride(
      doc,
      community,
      blockId,
      actorUserId,
      openVariantsBeforeOverride,
    ).catch((err) => {
      this.logger.warn(
        `Failed to notify open variant authors about admin override: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  /** §13.4 — force-close voting wave on a block (admin / document author). */
  async closeVotingWaveOnBlock(
    actorUserId: string,
    documentId: string,
    blockId: string,
  ): Promise<void> {
    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted) {
      throw new NotFoundException('Document not found');
    }
    await this.assertCanManageDocument(actorUserId, doc);
    const block = this.documentService.findBlock(doc, blockId);
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    await this.finalizeExpiredWaveOnBlock(documentId, blockId, { force: true });
  }

  /** §7.3 — soft-delete a variant (admin / document author). */
  async deleteVariantAsAdmin(actorUserId: string, variantId: string): Promise<void> {
    const v = await this.documentService.getVariantById(variantId);
    if (!v || v.deleted) {
      throw new NotFoundException('Variant not found');
    }
    const doc = await this.documentService.getById(v.documentId);
    if (!doc || doc.deleted) {
      throw new NotFoundException('Document not found');
    }
    await this.assertCanManageDocument(actorUserId, doc);
    if (v.status === 'applied') {
      throw new BadRequestException('Cannot delete an applied variant');
    }
    await this.documentPersistence.softDeleteVariant(variantId);
  }

  private async applyVariantToOfficial(
    actorUserId: string,
    v: DocumentBlockVariantSchemaClass,
    doc: MeriterDocumentSchemaClass,
    reason: 'vote' | 'admin',
  ): Promise<void> {
    const now = new Date();
    const openVariantsBeforeApply = await this.documentPersistence.findOpenVariants(
      doc.id,
      v.blockId,
    ).then((rows) => rows.filter((row) => row.id !== v.id));
    const ok = await this.documentService.updateDocumentBlock(doc.id, v.blockId, (b) => {
      const previousContent = String(b.officialContent ?? '');
      this.documentService.appendBlockEditHistory(b, {
        changedAt: now,
        changedBy: actorUserId,
        reason,
        ...(reason === 'vote' ? { variantId: v.id } : {}),
        previousContent,
      });
      b.officialContent = v.content;
      b.officialContentSetAt = now;
      b.officialContentSetBy = actorUserId;
      b.officialContentReason = reason;
      if (reason === 'vote') {
        b.officialContentVariantId = v.id;
      } else {
        delete b.officialContentVariantId;
      }
      delete b.currentWaveStartedAt;
    });
    if (!ok) {
      throw new BadRequestException('Failed to update block');
    }

    await this.documentPersistence.updateVariantsStatusByFilter(
      {
        documentId: doc.id,
        blockId: v.blockId,
        id: { $ne: v.id },
        status: 'open',
        deleted: false,
      },
      'closed-not-winner',
    );

    await this.documentPersistence.markVariantApplied(v.id, now, actorUserId);

    await this.documentService.mirrorOfficialTextToCommunityIfApplicable(doc.id);

    const community = await this.communityService.getCommunity(doc.communityId);
    if (community) {
      if (openVariantsBeforeApply.length > 0) {
        await this.notifyVariantsNotSelected({
          doc,
          community,
          blockId: v.blockId,
          variants: openVariantsBeforeApply,
          winnerVariantId: v.id,
          reason: reason === 'vote' ? 'other_variant_won' : 'applied_by_admin',
          actorUserId,
        }).catch((err) => {
          this.logger.warn(
            `Failed to notify non-selected variants after apply ${v.id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        });
      }
      await this.notifyVariantApplied(v, doc, community).catch((err) => {
        this.logger.warn(
          `Failed to notify variant applied ${v.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }

  /**
   * Auto-apply closed winner when document is in auto mode (§12.2).
   * Invoked by FinalizeDocumentWaveUseCase via the orchestration callback (Zone 8 inversion).
   */
  async tryAutoApplyWinner(documentId: string, blockId: string): Promise<void> {
    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted || doc.mode !== 'auto') {
      return;
    }
    const winner = await this.documentPersistence.findClosedWinnerVariant(documentId, blockId);
    if (!winner || (winner.rating ?? 0) <= 0) {
      return;
    }
    try {
      await this.applyVariantToOfficial(
        MERITER_DOCUMENT_AUTO_APPLY_USER_ID,
        winner as DocumentBlockVariantSchemaClass,
        doc,
        'vote',
      );
    } catch (err) {
      this.logger.warn(
        `tryAutoApplyWinner ${documentId}/${blockId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private assertDocumentsModeAllowsDocument(
    community: Community,
    docType: MeriterDocType,
  ): void {
    const mode = community.settings?.documentsMode ?? 'visionOrDescriptionOnly';
    if (mode === 'off') {
      throw new ForbiddenException('Collaborative documents are disabled in this community');
    }
    if (mode === 'visionOrDescriptionOnly' && docType === 'custom') {
      throw new ForbiddenException('Custom documents are not enabled for this community');
    }
  }

  

  async assertCanManageDocument(
    userId: string,
    doc: MeriterDocumentSchemaClass,
  ): Promise<void> {
    const canManage = await this.permissionService.canManageCollaborativeDocument(
      userId,
      doc.id,
    );
    if (!canManage) {
      throw new ForbiddenException('Only the document author or a community admin can apply variants');
    }
  }

  async assertCanEditDocumentStructure(
    userId: string,
    doc: MeriterDocumentSchemaClass,
  ): Promise<void> {
    const canEdit = await this.permissionService.canEditDocumentStructure(userId, doc.id);
    if (!canEdit) {
      throw new ForbiddenException('You cannot edit this document structure');
    }
  }

  

  

  private buildDocumentNotificationMetadata(
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

  

  private async notifyVariantsNotSelected(params: {
    doc: MeriterDocumentSchemaClass;
    community: Community;
    blockId: string;
    variants: Array<{ id: string; proposedBy: string }>;
    winnerVariantId?: string;
    reason:
      | 'official_kept'
      | 'other_variant_won'
      | 'no_positive_winner'
      | 'applied_by_admin';
    actorUserId?: string;
  }): Promise<void> {
    const { doc, community, blockId, variants, winnerVariantId, reason, actorUserId } = params;
    if (variants.length === 0) {
      return;
    }

    const winner = winnerVariantId
      ? variants.find((variant) => variant.id === winnerVariantId)
      : null;
    const metadata = {
      ...this.buildDocumentNotificationMetadata(doc, community, blockId),
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
          : reason === 'applied_by_admin'
            ? `Another variant was applied on "${title}", so your open variant was closed.`
            : `Voting ended on "${title}" and another variant was selected.`;

    for (const userId of recipientIds) {
      await this.notificationService.createNotification({
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

  private async notifyVariantWon(
    variant: { id: string; proposedBy: string; documentId: string; blockId: string },
    doc: MeriterDocumentSchemaClass,
  ): Promise<void> {
    if (!variant.proposedBy) {
      return;
    }
    const community = await this.communityService.getCommunity(doc.communityId);
    if (!community) {
      return;
    }
    const title = doc.title?.trim() || 'Document';
    await this.notificationService.createNotification({
      userId: variant.proposedBy,
      type: 'document_variant_won',
      source: 'system',
      metadata: this.buildDocumentNotificationMetadata(doc, community, variant.blockId),
      title: 'Your variant won the vote',
      message: `Your proposed text won voting on "${title}".`,
    });
  }

  private async notifyVariantApplied(
    variant: { id: string; proposedBy: string; blockId: string },
    doc: MeriterDocumentSchemaClass,
    community: Community,
  ): Promise<void> {
    if (!variant.proposedBy) {
      return;
    }
    const title = doc.title?.trim() || 'Document';
    await this.notificationService.createNotification({
      userId: variant.proposedBy,
      type: 'document_variant_applied',
      source: 'system',
      metadata: this.buildDocumentNotificationMetadata(doc, community, variant.blockId),
      title: 'Your variant is now official',
      message: `Your proposed text was applied as the official text of "${title}".`,
    });
  }

  private async notifyBlockAdminOverride(
    doc: MeriterDocumentSchemaClass,
    community: Community,
    blockId: string,
    actorUserId: string,
    openVariants: Array<{ proposedBy?: string }>,
  ): Promise<void> {
    const title = doc.title?.trim() || 'Document';
    const metadata = this.buildDocumentNotificationMetadata(doc, community, blockId);
    const recipientIds = new Set(
      openVariants
        .map((v) => v.proposedBy)
        .filter((id): id is string => typeof id === 'string' && id.length > 0 && id !== actorUserId),
    );
    for (const userId of recipientIds) {
      await this.notificationService.createNotification({
        userId,
        type: 'document_block_admin_override',
        source: 'system',
        sourceId: actorUserId,
        metadata,
        title: 'Voting closed by administrator',
        message: `An administrator set new official text on "${title}"; your open variant was not selected.`,
      });
    }
  }
}
