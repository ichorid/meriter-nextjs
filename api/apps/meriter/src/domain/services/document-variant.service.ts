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
  type ProposeDocumentVariantInput,
  type ProposeDocumentVariantPort,
} from '../ports/propose-document-variant.port';
import { CommunityService } from './community.service';
import { DocumentLiveUpdatesService } from './document-live-updates.service';
import { DocumentService } from './document.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { MERITER_DOCUMENT_AUTO_APPLY_USER_ID } from '../common/constants/meriter-actors.constant';
import { sanitizeDocumentHtml } from '../../common/utils/sanitize-document-html';
import { blockHtmlToPlainText } from '../common/document-plain-text.util';
import {
  insertBlocksAfterInSection,
  type SectionBlockRow,
} from '../common/document-block-structure.util';
import type { ParsedStructureBlock } from '../common/document-html-structure.util';
import {
  applyBlockSplitsForPatches,
  isFullBlockDeletionPatch,
  isInsertBlocksPatch,
  type DocumentVariantPatch,
} from '../common/document-proposal-patches.util';
import { opsToPatches } from '../common/document-document-ops.util';
import {
  hashJoinedDocumentAtPropose,
  isStaleVariant,
  mergeRangeIntoBlockHtml,
  resolveVariantRangeBounds,
} from '../common/document-range.util';
import {
  type DocumentVariantReferenceInput,
} from '../common/document-variant-references.util';

export type { DocumentVariantReferenceInput };

const MAX_VARIANT_CONTENT = 5000;

export type CloseVotingWaveResolution =
  | { mode: 'by_votes' }
  | { mode: 'force_official' }
  | { mode: 'force_variant'; variantId: string };

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
    private readonly documentLiveUpdates: DocumentLiveUpdatesService,
  ) {}

  async listByBlock(documentId: string, blockId: string): Promise<DocumentBlockVariantSchemaClass[]> {
    const variants = await this.documentPersistence.findVariantsByBlock(documentId, blockId);
    return variants as DocumentBlockVariantSchemaClass[];
  }

  async listActiveByDocument(documentId: string): Promise<DocumentBlockVariantSchemaClass[]> {
    const variants = await this.documentPersistence.findActiveVariantsByDocument(documentId);
    return variants as DocumentBlockVariantSchemaClass[];
  }

  async findOpenVotingThreads(documentId: string) {
    return this.documentPersistence.findOpenVotingThreads(documentId);
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
    const threads = await this.documentPersistence.findOpenVotingThreads(documentId);
    const now = Date.now();
    for (const thread of threads) {
      if (new Date(thread.waveEndsAt).getTime() <= now) {
        await this.finalizeDocumentWaveUseCase.finalizeThread(thread);
      }
    }
    return this.finalizeDocumentWaveUseCase.finalizeBlock(documentId, blockId, options);
  }

  async tryAutoApplyThreadWinner(documentId: string, variantId: string): Promise<void> {
    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted || doc.mode !== 'auto') {
      return;
    }
    const record = await this.documentPersistence.findVariantById(variantId);
    if (!record || record.status !== 'closed-winner') {
      return;
    }
    await this.applyVariantToOfficial(
      MERITER_DOCUMENT_AUTO_APPLY_USER_ID,
      record as DocumentBlockVariantSchemaClass,
      doc,
      'vote',
      { skipStaleCheck: true },
    );
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
    input: ProposeDocumentVariantInput,
  ) {
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
    await this.maybeCloseVotingWaveWhenNoOpenVariants(
      userId,
      v.documentId,
      v.blockId,
      'vote',
    );
    this.documentLiveUpdates.publish({
      type: 'variant.withdrawn',
      documentId: v.documentId,
      blockId: v.blockId,
      variantId,
      actorUserId: userId,
    });
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
  async applyVotingWinner(
    actorUserId: string,
    variantId: string,
    options?: { confirmStale?: boolean },
  ): Promise<void> {
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

    const block = this.documentService.findBlock(doc, v.blockId);
    if (
      block &&
      isStaleVariant(v.officialTextHashAtPropose, String(block.officialContent ?? '')) &&
      !options?.confirmStale
    ) {
      throw new BadRequestException(
        'Official text changed since this variant was proposed; confirm apply to continue',
      );
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
    resolution: CloseVotingWaveResolution = { mode: 'by_votes' },
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

    if (resolution.mode === 'force_variant') {
      const v = await this.documentService.getVariantById(resolution.variantId);
      if (!v || v.deleted) {
        throw new NotFoundException('Variant not found');
      }
      if (v.documentId !== documentId || v.blockId !== blockId) {
        throw new BadRequestException('Variant does not belong to this block');
      }
      await this.applyOpenVariantAsAdmin(actorUserId, resolution.variantId);
      this.publishWaveClosed(doc, blockId, actorUserId);
      return;
    }

    if (resolution.mode === 'force_official') {
      await this.closeVotingWaveKeepingOfficial(actorUserId, doc, blockId);
      return;
    }

    await this.finalizeExpiredWaveOnBlock(documentId, blockId, { force: true });
    await this.applyClosedWinnersToOfficial(actorUserId, documentId, blockId, {
      skipStaleCheck: true,
    });
  }

  private publishWaveClosed(
    doc: MeriterDocumentSchemaClass,
    blockId: string,
    actorUserId?: string,
  ): void {
    this.documentLiveUpdates.publish({
      type: 'wave.closed',
      documentId: doc.id,
      documentUpdatedAt: doc.updatedAt,
      blockId,
      actorUserId,
    });
  }

  /**
   * When the wave is active but no open variants remain, end voting and keep official text.
   * Used after admin deletes the last proposal or the last author withdraws.
   */
  private async maybeCloseVotingWaveWhenNoOpenVariants(
    actorUserId: string,
    documentId: string,
    blockId: string,
    historyReason: 'admin' | 'vote',
  ): Promise<void> {
    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted) {
      return;
    }
    const block = this.documentService.findBlock(doc, blockId);
    if (!block?.currentWaveStartedAt) {
      return;
    }
    if (!this.documentService.isDocumentBlockVotingOpen(doc, blockId)) {
      return;
    }
    const openVariants = await this.documentPersistence.findOpenVariants(documentId, blockId);
    if (openVariants.length > 0) {
      return;
    }
    await this.closeVotingWaveKeepingOfficial(actorUserId, doc, blockId, historyReason);
  }

  /** Admin ends wave early and keeps current official text (recorded in block history). */
  private async closeVotingWaveKeepingOfficial(
    actorUserId: string,
    doc: MeriterDocumentSchemaClass,
    blockId: string,
    historyReason: 'admin' | 'vote' = 'admin',
  ): Promise<void> {
    const openVariants = await this.documentPersistence.findOpenVariants(doc.id, blockId);
    const now = new Date();

    for (const v of openVariants) {
      await this.documentPersistence.updateVariantStatus(v.id, 'closed-not-winner');
    }

    const ok = await this.documentService.updateDocumentBlock(doc.id, blockId, (b) => {
      this.documentService.appendBlockEditHistory(b, {
        changedAt: now,
        changedBy: actorUserId,
        reason: historyReason,
        previousContent: String(b.officialContent ?? ''),
      });
      delete b.currentWaveStartedAt;
      b.officialRating = 0;
      if (historyReason === 'admin') {
        b.officialContentSetAt = now;
        b.officialContentSetBy = actorUserId;
        b.officialContentReason = 'admin';
        delete b.officialContentVariantId;
      }
    });
    if (!ok) {
      throw new BadRequestException('Failed to update block');
    }

    const community = await this.communityService.getCommunity(doc.communityId);
    if (community && openVariants.length > 0) {
      await this.notifyVariantsNotSelected({
        doc,
        community,
        blockId,
        variants: openVariants,
        reason: 'official_kept',
        actorUserId,
      }).catch((err) => {
        this.logger.warn(
          `Failed to notify variants after admin kept official ${doc.id}/${blockId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }

    this.publishWaveClosed(doc, blockId, actorUserId);
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
    await this.maybeCloseVotingWaveWhenNoOpenVariants(
      actorUserId,
      v.documentId,
      v.blockId,
      'admin',
    );
  }

  private async removeDocumentBlocksByIds(
    doc: MeriterDocumentSchemaClass,
    blockIds: string[],
    exceptVariantId?: string,
  ): Promise<void> {
    if (blockIds.length === 0) {
      return;
    }
    const removeSet = new Set(blockIds);
    const rows = this.collectDocumentBlockRows(doc);
    if (rows.length - blockIds.length < 1) {
      throw new BadRequestException('Cannot remove every block in the document');
    }
    for (const blockId of blockIds) {
      await this.documentPersistence.withdrawOpenVariantsOnBlock(
        doc.id,
        blockId,
        exceptVariantId,
      );
    }
    const sections = [...(doc.sections ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    const nextSections = sections
      .map((sec) => ({
        ...sec,
        blocks: [...(sec.blocks ?? [])]
          .sort((a, b) => a.order - b.order)
          .filter((b) => !removeSet.has(b.id))
          .map((b, order) => ({ ...b, order })),
      }))
      .filter((sec) => (sec.blocks?.length ?? 0) > 0);
    if (nextSections.length === 0) {
      throw new BadRequestException('Cannot remove every block in the document');
    }
    const result = await this.documentService.updateSections(doc.id, nextSections);
    if (!result.ok) {
      throw new BadRequestException('Failed to remove blocks after applying variant');
    }
  }

  private collectDocumentBlockRows(
    doc: MeriterDocumentSchemaClass,
  ): SectionBlockRow[] {
    const rows: SectionBlockRow[] = [];
    const sections = [...(doc.sections ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    for (const sec of sections) {
      for (const b of [...(sec.blocks ?? [])].sort((a, c) => a.order - c.order)) {
        rows.push(b as SectionBlockRow);
      }
    }
    return rows;
  }

  private resolveVariantPatches(v: DocumentBlockVariantSchemaClass): DocumentVariantPatch[] {
    if (v.patches && v.patches.length > 0) {
      return v.patches.map((p) => ({
        blockId: p.blockId,
        rangeStart: p.rangeStart,
        rangeEnd: p.rangeEnd,
        proposedText: p.proposedText ?? '',
        previewContent: p.previewContent,
        insertAfterBlockId: p.insertAfterBlockId,
        insertBlocks: p.insertBlocks,
      }));
    }
    if (v.ops && v.ops.length > 0) {
      return opsToPatches(v.ops);
    }
    return [
      {
        blockId: v.blockId,
        rangeStart: v.rangeStart ?? 0,
        rangeEnd: v.rangeEnd ?? 0,
        proposedText: v.proposedText ?? '',
        previewContent: v.content,
      },
    ];
  }

  private async applyPatchesVariant(
    actorUserId: string,
    v: DocumentBlockVariantSchemaClass,
    doc: MeriterDocumentSchemaClass,
    patches: DocumentVariantPatch[],
    reason: 'vote' | 'admin',
    options?: { skipStaleCheck?: boolean },
  ): Promise<void> {
    const blockRows = this.collectDocumentBlockRows(doc);
    const currentHash = hashJoinedDocumentAtPropose(
      blockRows.map((b) => ({ id: b.id, officialContent: b.officialContent })),
    );
    if (!options?.skipStaleCheck && v.officialTextHashAtPropose !== currentHash) {
      throw new BadRequestException(
        'Official text changed since this variant was proposed; confirm apply to continue',
      );
    }

    const now = new Date();
    const affectedBlockIds = new Set<string>();
    const blockIdsToRemove: string[] = [];
    let workingDoc = doc;

    let patchesToApply = [...patches];
    const rangePatches = patchesToApply.filter((p) => !isInsertBlocksPatch(p));
    const partialNeedsSplit = rangePatches.some((patch) => {
      const block = this.documentService.findBlock(workingDoc, patch.blockId);
      if (!block) {
        return false;
      }
      const plainLen = blockHtmlToPlainText(String(block.officialContent ?? '')).length;
      return plainLen > 0 && (patch.rangeStart > 0 || patch.rangeEnd < plainLen);
    });

    if (partialNeedsSplit) {
      const rows = this.collectDocumentBlockRows(workingDoc);
      const { blocks: splitBlocks, patches: splitPatches } = applyBlockSplitsForPatches(
        rows,
        rangePatches,
      );
      const sections = [...(workingDoc.sections ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      );
      const sectionIndex = sections.findIndex((sec) =>
        (sec.blocks ?? []).some((b) => rangePatches.some((p) => p.blockId === b.id)),
      );
      if (sectionIndex < 0) {
        throw new BadRequestException('Failed to locate section for block split');
      }
      const nextSections = sections.map((sec, idx) =>
        idx === sectionIndex
          ? { ...sec, blocks: splitBlocks.map((b, order) => ({ ...b, order })) }
          : sec,
      );
      const updated = await this.documentService.updateSections(workingDoc.id, nextSections);
      if (!updated.ok) {
        throw new BadRequestException('Failed to split blocks for variant apply');
      }
      const refreshed = await this.documentService.getById(workingDoc.id);
      if (!refreshed) {
        throw new NotFoundException('Document not found');
      }
      workingDoc = refreshed;
      patchesToApply = [
        ...patchesToApply.filter(isInsertBlocksPatch),
        ...splitPatches,
      ];
    }

    for (const patch of patchesToApply.filter(isInsertBlocksPatch)) {
      const { doc: nextDoc, newBlockIds } = await this.applyInsertBlocksPatch(
        actorUserId,
        workingDoc,
        patch,
        reason,
        v,
      );
      workingDoc = nextDoc;
      affectedBlockIds.add(patch.blockId);
      for (const id of newBlockIds) {
        affectedBlockIds.add(id);
      }
    }

    for (const patch of patchesToApply.filter((p) => !isInsertBlocksPatch(p))) {
      affectedBlockIds.add(patch.blockId);
      const block = this.documentService.findBlock(workingDoc, patch.blockId);
      if (!block) {
        throw new NotFoundException(`Block not found: ${patch.blockId}`);
      }
      const officialHtml = String(block.officialContent ?? '');
      if (isFullBlockDeletionPatch(officialHtml, patch)) {
        blockIdsToRemove.push(patch.blockId);
        continue;
      }
      const nextOfficial = mergeRangeIntoBlockHtml(
        officialHtml,
        patch.rangeStart,
        patch.rangeEnd,
        patch.proposedText,
      );
      const ok = await this.documentService.updateDocumentBlock(workingDoc.id, patch.blockId, (b) => {
        const previousContent = String(b.officialContent ?? '');
        this.documentService.appendBlockEditHistory(b, {
          changedAt: now,
          changedBy: actorUserId,
          reason,
          ...(reason === 'vote' ? { variantId: v.id } : {}),
          previousContent,
        });
        b.officialContent = nextOfficial;
        b.officialContentSetAt = now;
        b.officialContentSetBy = actorUserId;
        b.officialContentReason = reason;
        if (reason === 'vote' && patch.blockId === v.blockId) {
          b.officialContentVariantId = v.id;
        } else if (reason === 'vote') {
          delete b.officialContentVariantId;
        } else {
          delete b.officialContentVariantId;
        }
        delete b.currentWaveStartedAt;
      });
      if (!ok) {
        throw new BadRequestException(`Failed to update block ${patch.blockId}`);
      }
    }

    if (blockIdsToRemove.length > 0) {
      const refreshed = (await this.documentService.getById(workingDoc.id))!;
      workingDoc = refreshed ?? workingDoc;
      await this.removeDocumentBlocksByIds(workingDoc, blockIdsToRemove, v.id);
    }

    for (const blockId of affectedBlockIds) {
      await this.documentPersistence.updateVariantsStatusByFilter(
        {
          documentId: workingDoc.id,
          blockId,
          id: { $ne: v.id },
          status: 'open',
          deleted: false,
        },
        'closed-not-winner',
      );
    }

    await this.documentPersistence.markVariantApplied(v.id, now, actorUserId);
    await this.documentService.mirrorOfficialTextToCommunityIfApplicable(workingDoc.id);

    const community = await this.communityService.getCommunity(workingDoc.communityId);
    if (community) {
      await this.notifyVariantApplied(v, workingDoc, community).catch((err) => {
        this.logger.warn(
          `Failed to notify patches variant applied ${v.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }

    const refreshed = await this.documentService.getById(workingDoc.id);
    this.documentLiveUpdates.publish({
      type: 'variant.applied',
      documentId: workingDoc.id,
      documentUpdatedAt: refreshed?.updatedAt,
      blockId: v.blockId,
      variantId: v.id,
      actorUserId,
    });
  }

  private async applyInsertBlocksPatch(
    actorUserId: string,
    doc: MeriterDocumentSchemaClass,
    patch: DocumentVariantPatch,
    reason: 'vote' | 'admin',
    v: DocumentBlockVariantSchemaClass,
  ): Promise<{ doc: MeriterDocumentSchemaClass; newBlockIds: string[] }> {
    const afterId = patch.insertAfterBlockId;
    const parsed = (patch.insertBlocks ?? []) as ParsedStructureBlock[];
    if (!afterId || parsed.length === 0) {
      throw new BadRequestException('Insert patch is missing blocks');
    }

    const sections = [...(doc.sections ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    let found = false;
    let insertedBlockIds: string[] = [];
    const now = new Date();
    const nextSections = sections.map((sec) => {
      const blocks = [...(sec.blocks ?? [])].sort((a, b) => a.order - b.order);
      const index = blocks.findIndex((b) => b.id === afterId);
      if (index < 0) {
        return sec;
      }
      found = true;
      const { blocks: nextBlocks, newBlockIds } = insertBlocksAfterInSection(
        blocks as SectionBlockRow[],
        afterId,
        parsed,
      );
      insertedBlockIds = newBlockIds;
      const stamped = nextBlocks.map((b) => {
        if (!newBlockIds.includes(b.id)) {
          return b;
        }
        return {
          ...b,
          officialContentSetAt: now,
          officialContentSetBy: actorUserId,
          officialContentReason: reason,
          ...(reason === 'vote' ? { officialContentVariantId: v.id } : {}),
        };
      });
      return { ...sec, blocks: stamped };
    });

    if (!found) {
      throw new NotFoundException(`Block not found: ${afterId}`);
    }

    const result = await this.documentService.updateSections(doc.id, nextSections);
    if (!result.ok) {
      throw new BadRequestException('Failed to insert blocks from variant');
    }

    const refreshed = await this.documentService.getById(doc.id);
    if (!refreshed) {
      throw new NotFoundException('Document not found');
    }

    return { doc: refreshed, newBlockIds: insertedBlockIds };
  }

  private async applyVariantToOfficial(
    actorUserId: string,
    v: DocumentBlockVariantSchemaClass,
    doc: MeriterDocumentSchemaClass,
    reason: 'vote' | 'admin',
    options?: { skipStaleCheck?: boolean },
  ): Promise<void> {
    const patches = this.resolveVariantPatches(v);
    if (
      v.proposalScope === 'patches' ||
      patches.length > 1 ||
      patches.some(isInsertBlocksPatch)
    ) {
      await this.applyPatchesVariant(actorUserId, v, doc, patches, reason, options);
      return;
    }

    const block = this.documentService.findBlock(doc, v.blockId);
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    const officialHtml = String(block.officialContent ?? '');
    if (
      !options?.skipStaleCheck &&
      isStaleVariant(v.officialTextHashAtPropose, officialHtml)
    ) {
      throw new BadRequestException(
        'Official text changed since this variant was proposed; confirm apply to continue',
      );
    }

    const bounds = resolveVariantRangeBounds(v, officialHtml);
    const hasRange =
      typeof v.rangeStart === 'number' &&
      typeof v.rangeEnd === 'number' &&
      v.proposedText != null;
    const nextOfficial = hasRange
      ? mergeRangeIntoBlockHtml(
          officialHtml,
          bounds.rangeStart,
          bounds.rangeEnd,
          v.proposedText ?? '',
        )
      : v.content;

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
      b.officialContent = nextOfficial;
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

    const updatedDoc = await this.documentService.getById(doc.id);
    const updatedBlock = updatedDoc
      ? this.documentService.findBlock(updatedDoc, v.blockId)
      : null;
    const updatedHtml = String(updatedBlock?.officialContent ?? '');
    const plainLen = blockHtmlToPlainText(updatedHtml).length;
    for (const open of openVariantsBeforeApply) {
      const ob = resolveVariantRangeBounds(open, updatedHtml);
      if (ob.rangeEnd > plainLen || ob.rangeStart >= plainLen) {
        await this.documentPersistence.updateVariantStatus(open.id, 'withdrawn');
      }
    }

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
          `Failed to notify variant applied ${v.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }

    const refreshed = await this.documentService.getById(doc.id);
    this.documentLiveUpdates.publish({
      type: 'variant.applied',
      documentId: doc.id,
      documentUpdatedAt: refreshed?.updatedAt,
      blockId: v.blockId,
      variantId: v.id,
      actorUserId,
    });
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
    await this.applyClosedWinnersToOfficial(
      MERITER_DOCUMENT_AUTO_APPLY_USER_ID,
      documentId,
      blockId,
      { skipStaleCheck: true },
    );
  }

  /**
   * Apply closed-winner variant(s) with positive rating to official text (range order: end → start).
   * Used after auto-mode finalize and after admin «by votes» wave close.
   */
  private async applyClosedWinnersToOfficial(
    actorUserId: string,
    documentId: string,
    blockId: string,
    options?: { skipStaleCheck?: boolean },
  ): Promise<void> {
    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted) {
      return;
    }
    const winners = await this.documentPersistence.findClosedWinnerVariants(
      documentId,
      blockId,
    );
    const rated = winners.filter((w) => (w.rating ?? 0) > 0);
    if (rated.length === 0) {
      return;
    }

    const block = this.documentService.findBlock(doc, blockId);
    const officialHtml = String(block?.officialContent ?? '');
    const ordered = [...rated].sort((a, b) => {
      const ba = resolveVariantRangeBounds(a, officialHtml);
      const bb = resolveVariantRangeBounds(b, officialHtml);
      return bb.rangeStart - ba.rangeStart;
    });

    for (const winner of ordered) {
      const freshDoc = await this.documentService.getById(documentId);
      if (!freshDoc) {
        return;
      }
      const freshBlock = this.documentService.findBlock(freshDoc, blockId);
      if (
        !options?.skipStaleCheck &&
        isStaleVariant(
          winner.officialTextHashAtPropose,
          String(freshBlock?.officialContent ?? ''),
        )
      ) {
        continue;
      }
      try {
        await this.applyVariantToOfficial(
          actorUserId,
          winner as DocumentBlockVariantSchemaClass,
          freshDoc,
          'vote',
          { skipStaleCheck: options?.skipStaleCheck === true },
        );
      } catch (err) {
        this.logger.warn(
          `applyClosedWinnersToOfficial ${documentId}/${blockId}/${winner.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
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
