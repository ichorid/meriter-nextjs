import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Connection } from 'mongoose';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import {
  normalizeDocumentVariantReferences,
  type DocumentVariantReferenceInput,
} from '../../../domain/common/document-variant-references.util';
import type { Community } from '../../../domain/models/community/community.schema';
import type { DocumentBlockVariantSchemaClass } from '../../../domain/models/document-block-variant/document-block-variant.schema';
import type {
  MeriterDocumentSchemaClass,
  MeriterDocType,
} from '../../../domain/models/meriter-document/meriter-document.schema';
import type { DocumentPersistencePort } from '../../../domain/ports/document.persistence.port';
import type { CommunityService } from '../../../domain/services/community.service';
import type { DocumentLiveUpdatesService } from '../../../domain/services/document-live-updates.service';
import type { DocumentService } from '../../../domain/services/document.service';
import type { NotificationService } from '../../../domain/services/notification.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import { sanitizeDocumentHtml } from '../../../common/utils/sanitize-document-html';
import { blockHtmlToPlainText } from '../../../domain/common/document-plain-text.util';
import { getEffectiveLockedRanges } from '../../../domain/common/document-locked-ranges.util';
import {
  editChangeOverlapsLocked,
  insertBlocksAfterInSection,
  sanitizeProposedHtmlFragment,
  type SectionBlockRow,
} from '../../../domain/common/document-block-structure.util';
import type { ParsedStructureBlock } from '../../../domain/common/document-html-structure.util';
import {
  applyBlockSplitsForPatches,
  computeProposalPatchesFromJoinedContent,
  joinBlocksToSectionRows,
  newSectionId,
  normalizeVariantContentForPersistence,
  normalizeVariantPatchesForPersistence,
  type DocumentVariantPatch,
} from '../../../domain/common/document-proposal-patches.util';
import {
  assertNoOverlapWithOpenRanges,
  buildMergedBlockPreviewContent,
  hashJoinedDocumentAtPropose,
  normalizeRangeBounds,
} from '../../../domain/common/document-range.util';
import type {
  ProposeDocumentVariantInput,
  ProposeDocumentVariantPort,
} from '../../../domain/ports/propose-document-variant.port';
import {
  createGetRemainingQuotaUseCase,
  type CommunityQuotaContext,
} from '../wallets/get-remaining-quota.use-case';

export type { DocumentVariantReferenceInput };
export type { ProposeDocumentVariantInput } from '../../../domain/ports/propose-document-variant.port';

const MAX_VARIANT_CONTENT = 5000;

export type ProposeDocumentVariantDeps = {
  documentService: DocumentService;
  documentPersistence: DocumentPersistencePort;
  communityService: CommunityService;
  walletService: WalletService;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  notificationService: NotificationService;
  permissionService: PermissionService;
  connection: Connection;
  finalizeExpiredWaveOnBlock: (documentId: string, blockId: string) => Promise<void>;
  documentLiveUpdates: DocumentLiveUpdatesService;
};

/**
 * BC-06: propose a document block variant (§12.1).
 * inv-01: variantCost debited from quota and/or GLOBAL_COMMUNITY_ID wallet.
 */
export class ProposeDocumentVariantUseCase implements ProposeDocumentVariantPort {
  private readonly logger = new Logger(ProposeDocumentVariantUseCase.name);
  private readonly getRemainingQuota: ReturnType<typeof createGetRemainingQuotaUseCase>;

  constructor(private readonly deps: ProposeDocumentVariantDeps) {
    this.getRemainingQuota = createGetRemainingQuotaUseCase({
      communityService: this.deps.communityService,
    });
  }

  async execute(
    userId: string,
    input: ProposeDocumentVariantInput,
  ): Promise<DocumentBlockVariantSchemaClass> {
    let doc = await this.deps.documentService.getById(input.documentId);
    if (!doc || doc.deleted || doc.status !== 'active') {
      throw new NotFoundException('Document not found');
    }

    const community = await this.deps.communityService.getCommunity(doc.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    assertDocumentsModeAllowsDocument(community, doc.type);
    await assertCanAccessDocumentForProposal(this.deps, userId, community, doc);

    const prepared = await this.prepareProposalTarget(doc, input);
    doc = prepared.doc;
    const blockId = prepared.blockId;
    const block = this.deps.documentService.findBlock(doc, blockId);
    if (!block) {
      throw new NotFoundException('Block not found');
    }

    const hasRange = prepared.hasRange;
    const proposalScope = prepared.proposalScope;
    const patches = prepared.patches;
    const rangeStart = prepared.rangeStart;
    const rangeEnd = prepared.rangeEnd;
    const proposedText = prepared.proposedText;
    const content = prepared.content;

    if (content.length > MAX_VARIANT_CONTENT) {
      throw new BadRequestException(
        `Variant content must be at most ${MAX_VARIANT_CONTENT} characters`,
      );
    }

    const canManageDocument = await this.canManageDocumentForProposal(
      userId,
      doc,
      community,
    );
    await this.assertPatchesProposalAllowed(doc, patches, canManageDocument);

    const officialTextHashAtPropose = prepared.joinedOfficialHash;

    await this.deps.finalizeExpiredWaveOnBlock(doc.id, blockId);

    doc = (await this.deps.documentService.getById(input.documentId))!;

    const variantCost = doc.variantCost ?? 1;
    const { quotaAmount, walletAmount } = await this.collectVariantProposalFee(
      userId,
      doc.communityId,
      community,
      variantCost,
    );

    const refs = normalizeDocumentVariantReferences(input.references);

    const variantId = uid();
    const now = new Date();

    const blockAfter = this.deps.documentService.findBlock(doc, blockId);
    const needsWaveStart = !blockAfter?.currentWaveStartedAt;
    if (needsWaveStart) {
      await this.deps.documentService.updateDocumentBlock(doc.id, blockId, (b) => {
        b.currentWaveStartedAt = now;
        b.officialRating = 0;
      });
    }

    const officialHtmlForBlock = (patchBlockId: string) =>
      String(this.deps.documentService.findBlock(doc, patchBlockId)?.officialContent ?? '');
    const persistedPatches = normalizeVariantPatchesForPersistence(patches, officialHtmlForBlock);
    const persistedContent = normalizeVariantContentForPersistence(content, persistedPatches);

    const created = await this.deps.documentPersistence.insertVariant({
      id: variantId,
      documentId: doc.id,
      blockId,
      proposalScope: proposalScope ?? 'block',
      patches: persistedPatches,
      content: persistedContent,
      ...(hasRange
        ? {
            rangeStart,
            rangeEnd,
            proposedText,
            officialTextHashAtPropose,
          }
        : { officialTextHashAtPropose }),
      references: refs,
      ...(input.proposerComment?.trim()
        ? { proposerComment: input.proposerComment.trim().slice(0, 500) }
        : {}),
      proposedBy: userId,
      proposedAt: now,
      status: 'open',
      rating: 0,
      costPaid: variantCost,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    });

    await this.postCollectVariantProposalFee(
      userId,
      doc.communityId,
      community,
      quotaAmount,
      walletAmount,
      variantId,
    );

    await this.notifyVariantProposed(created as DocumentBlockVariantSchemaClass, doc, community).catch(
      (err) => {
        this.logger.warn(
          `Failed to notify new variant proposal ${variantId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      },
    );

    const docAfter = (await this.deps.documentService.getById(doc.id)) ?? doc;
    this.deps.documentLiveUpdates.publish({
      type: 'variant.proposed',
      documentId: docAfter.id,
      documentUpdatedAt: docAfter.updatedAt,
      blockId,
      variantId,
      actorUserId: userId,
    });

    return created as DocumentBlockVariantSchemaClass;
  }

  /**
   * Map unified-editor (joined HTML) proposals to the correct block, split structure when needed,
   * and persist new blocks before overlap / variant checks.
   */
  private async prepareProposalTarget(
    doc: MeriterDocumentSchemaClass,
    input: ProposeDocumentVariantInput,
  ): Promise<{
    doc: MeriterDocumentSchemaClass;
    blockId: string;
    proposalScope: 'block' | 'patches';
    patches: DocumentVariantPatch[];
    hasRange: boolean;
    rangeStart: number;
    rangeEnd: number;
    proposedText: string;
    content: string;
    joinedOfficialHash: string;
  }> {
    const located = this.locateBlockInDocument(doc, input.blockId);
    if (!located) {
      throw new NotFoundException('Block not found');
    }

    const orderedBlocks = this.collectAllDocumentBlocks(located.allSections);
    const content = sanitizeDocumentHtml(input.content ?? '');
    if (!content) {
      throw new BadRequestException('Variant content is required');
    }

    const computed = computeProposalPatchesFromJoinedContent(orderedBlocks, content);

    if (computed.appendBlocks && computed.appendBlocks.length > 0) {
      return this.prepareAppendProposal(doc, located, orderedBlocks, computed.appendBlocks);
    }

    if (computed.patches.length === 0) {
      throw new BadRequestException('No text changes detected in the proposal');
    }

    const { blocks: splitBlocks, patches } = applyBlockSplitsForPatches(
      orderedBlocks,
      computed.patches,
    );

    const sectionId =
      located.allSections[located.sectionIndex]?.id ?? newSectionId();
    const sectionsPayload = joinBlocksToSectionRows(splitBlocks, sectionId);
    const updated = await this.deps.documentService.updateSections(doc.id, sectionsPayload);
    if (!updated.ok) {
      throw new BadRequestException('Failed to update document structure for proposal');
    }

    const refreshed = await this.deps.documentService.getById(doc.id);
    if (!refreshed) {
      throw new NotFoundException('Document not found');
    }

    const anchor =
      patches.find((p) => p.blockId === computed.anchorBlockId) ?? patches[0]!;
    const proposalScope = patches.length > 1 ? ('patches' as const) : ('block' as const);

    return {
      doc: refreshed,
      blockId: anchor.blockId,
      proposalScope,
      patches,
      hasRange: true,
      rangeStart: anchor.rangeStart,
      rangeEnd: anchor.rangeEnd,
      proposedText: anchor.proposedText,
      content: anchor.previewContent,
      joinedOfficialHash: computed.joinedOfficialHash,
    };
  }

  private async prepareAppendProposal(
    doc: MeriterDocumentSchemaClass,
    located: {
      allSections: Array<{ id?: string; order?: number; blocks?: SectionBlockRow[] }>;
      sectionIndex: number;
      blocks: SectionBlockRow[];
    },
    orderedBlocks: SectionBlockRow[],
    appendParsed: ParsedStructureBlock[],
  ): Promise<{
    doc: MeriterDocumentSchemaClass;
    blockId: string;
    proposalScope: 'block';
    patches: DocumentVariantPatch[];
    hasRange: boolean;
    rangeStart: number;
    rangeEnd: number;
    proposedText: string;
    content: string;
    joinedOfficialHash: string;
  }> {
    const last = orderedBlocks[orderedBlocks.length - 1];
    if (!last) {
      throw new BadRequestException('Document has no blocks');
    }
    const { blocks: nextBlocks } = insertBlocksAfterInSection(
      orderedBlocks,
      last.id,
      appendParsed,
    );
    const sectionId =
      located.allSections[located.sectionIndex]?.id ?? newSectionId();
    const updated = await this.deps.documentService.updateSections(
      doc.id,
      joinBlocksToSectionRows(nextBlocks, sectionId),
    );
    if (!updated.ok) {
      throw new BadRequestException('Failed to append blocks for proposal');
    }
    const refreshed = (await this.deps.documentService.getById(doc.id))!;
    const lastBlock = nextBlocks[nextBlocks.length - 1]!;
    const proposedText = sanitizeProposedHtmlFragment(
      appendParsed.map((p) => p.officialContent).join(''),
    );
    const targetHtml = String(lastBlock.officialContent ?? '');
    const atEnd = blockHtmlToPlainText(targetHtml).length;
    const previewContent = buildMergedBlockPreviewContent(
      targetHtml,
      atEnd,
      atEnd,
      proposedText,
    );
    const patch: DocumentVariantPatch = {
      blockId: lastBlock.id,
      rangeStart: atEnd,
      rangeEnd: atEnd,
      proposedText,
      previewContent,
    };
    return {
      doc: refreshed,
      blockId: lastBlock.id,
      proposalScope: 'block',
      patches: [patch],
      hasRange: true,
      rangeStart: atEnd,
      rangeEnd: atEnd,
      proposedText,
      content: previewContent,
      joinedOfficialHash: hashJoinedDocumentAtPropose(
        orderedBlocks.map((b) => ({ id: b.id, officialContent: b.officialContent })),
      ),
    };
  }

  private async assertPatchesProposalAllowed(
    doc: MeriterDocumentSchemaClass,
    patches: DocumentVariantPatch[],
    canManageDocument: boolean,
  ): Promise<void> {
    for (const patch of patches) {
      const block = this.deps.documentService.findBlock(doc, patch.blockId);
      if (!block) {
        throw new BadRequestException('Proposal references an unknown block');
      }
      const officialHtml = String(block.officialContent ?? '');
      const oldPlain = blockHtmlToPlainText(officialHtml);
      const newPlain = blockHtmlToPlainText(patch.previewContent);
      const plainLen = oldPlain.length;
      const lockedSpans = getEffectiveLockedRanges(
        plainLen,
        block.proposalsLocked === true,
        block.lockedRanges as Array<{ rangeStart: number; rangeEnd: number }> | undefined,
      );
      if (!canManageDocument) {
        if (block.proposalsLocked === true) {
          throw new ForbiddenException('This block is locked; you cannot propose changes');
        }
        if (lockedSpans.length > 0 && editChangeOverlapsLocked(oldPlain, newPlain, lockedSpans)) {
          throw new ForbiddenException(
            'Your proposal would change text pinned by an administrator',
          );
        }
      }

      try {
        const openOnBlock = await this.deps.documentPersistence.findOpenVariants(
          doc.id,
          patch.blockId,
        );
        assertNoOverlapWithOpenRanges(
          patch.rangeStart,
          patch.rangeEnd,
          openOnBlock,
          officialHtml,
        );
      } catch (err) {
        if (err instanceof Error && err.message === 'RANGE_OVERLAP') {
          throw new ConflictException(
            'This range overlaps an open proposal on the same block',
          );
        }
        throw err;
      }
    }
  }

  private collectAllDocumentBlocks(
    sections: Array<{ order?: number; blocks?: SectionBlockRow[] }>,
  ): SectionBlockRow[] {
    const rows: SectionBlockRow[] = [];
    const sortedSections = [...sections].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    for (const sec of sortedSections) {
      for (const b of [...(sec.blocks ?? [])].sort((a, c) => a.order - c.order)) {
        rows.push(b as SectionBlockRow);
      }
    }
    return rows;
  }

  private locateBlockInDocument(
    doc: MeriterDocumentSchemaClass,
    blockId: string,
  ): {
    allSections: Array<{ order?: number; blocks?: SectionBlockRow[] }>;
    sectionIndex: number;
    blocks: SectionBlockRow[];
  } | null {
    const allSections = JSON.parse(JSON.stringify(doc.sections ?? [])) as Array<{
      order?: number;
      blocks?: SectionBlockRow[];
    }>;
    for (let i = 0; i < allSections.length; i++) {
      const sec = allSections[i]!;
      if ((sec.blocks ?? []).some((b) => b.id === blockId)) {
        return {
          allSections,
          sectionIndex: i,
          blocks: sec.blocks ?? [],
        };
      }
    }
    return null;
  }

  /**
   * Range proposals must not reshape official blocks (splits were previously persisted here
   * and broke feed preview with extra paragraph breaks).
   */
  private buildRangeProposalFromMapped(
    doc: MeriterDocumentSchemaClass,
    mapped: { blockId: string; localStart: number; localEnd: number },
    proposedText: string,
  ): {
    doc: MeriterDocumentSchemaClass;
    blockId: string;
    hasRange: true;
    rangeStart: number;
    rangeEnd: number;
    proposedText: string;
    content: string;
  } {
    const target = this.deps.documentService.findBlock(doc, mapped.blockId);
    if (!target) {
      throw new NotFoundException('Block not found');
    }
    const targetHtml = String(target.officialContent ?? '');
    const plainLen = blockHtmlToPlainText(targetHtml).length;
    const local = normalizeRangeBounds(plainLen, mapped.localStart, mapped.localEnd);
    return {
      doc,
      blockId: mapped.blockId,
      hasRange: true,
      rangeStart: local.rangeStart,
      rangeEnd: local.rangeEnd,
      proposedText,
      content: buildMergedBlockPreviewContent(
        targetHtml,
        local.rangeStart,
        local.rangeEnd,
        proposedText,
      ),
    };
  }

  private buildAppendAtEndRangeProposal(
    doc: MeriterDocumentSchemaClass,
    segments: BlockPlainSegment[],
    _appendParsed: ParsedStructureBlock[],
    proposedText: string,
  ): {
    doc: MeriterDocumentSchemaClass;
    blockId: string;
    hasRange: true;
    rangeStart: number;
    rangeEnd: number;
    proposedText: string;
    content: string;
  } {
    const last = segments[segments.length - 1];
    if (!last) {
      throw new BadRequestException('Document has no blocks');
    }
    const atEnd = last.plainEnd - last.plainStart;
    return this.buildRangeProposalFromMapped(
      doc,
      { blockId: last.blockId, localStart: atEnd, localEnd: atEnd },
      proposedText,
    );
  }

  private async collectVariantProposalFee(
    userId: string,
    communityId: string,
    community: Community,
    variantCost: number,
  ): Promise<{ quotaAmount: number; walletAmount: number }> {
    if (variantCost <= 0) {
      return { quotaAmount: 0, walletAmount: 0 };
    }

    const canPayFromQuota = community.settings?.canPayPostFromQuota ?? false;
    let quotaAmount = 0;
    let walletAmount = 0;
    const quotaDb = this.deps.connection.db;
    if (!quotaDb) {
      throw new BadRequestException('Database connection not available');
    }

    if (canPayFromQuota) {
      const remainingQuota = await this.getRemainingQuota.forPublicationCreate({
        userId,
        communityId,
        community: community as CommunityQuotaContext,
        db: quotaDb,
      });
      quotaAmount = Math.min(variantCost, remainingQuota);
      walletAmount = Math.max(0, variantCost - quotaAmount);
    } else {
      walletAmount = variantCost;
    }

    if (walletAmount > 0) {
      const wallet = await this.deps.walletService.getWallet(userId, GLOBAL_COMMUNITY_ID);
      const bal = wallet ? wallet.getBalance() : 0;
      if (bal < walletAmount) {
        throw new BadRequestException(
          `Insufficient wallet merits. Available: ${bal}, Required: ${walletAmount}`,
        );
      }
    }

    if (quotaAmount > 0) {
      const remainingQuota = await this.getRemainingQuota.forPublicationCreate({
        userId,
        communityId,
        community: community as CommunityQuotaContext,
        db: quotaDb,
      });
      if (remainingQuota < quotaAmount) {
        throw new BadRequestException(
          `Insufficient quota. Available: ${remainingQuota}, Required: ${quotaAmount}`,
        );
      }
    }

    return { quotaAmount, walletAmount };
  }

  private async postCollectVariantProposalFee(
    userId: string,
    communityId: string,
    community: Community,
    quotaAmount: number,
    walletAmount: number,
    variantId: string,
  ): Promise<void> {
    const currency = community.settings?.currencyNames ?? {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    const globalCommunity = await this.deps.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
    const feeCurrency = globalCommunity?.settings?.currencyNames ?? currency;

    if (quotaAmount > 0 && this.deps.connection.db) {
      await this.deps.connection.db.collection('quota_usage').insertOne({
        id: `quota_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        userId,
        communityId,
        amountQuota: quotaAmount,
        usageType: 'document_variant_proposal',
        referenceId: variantId,
        createdAt: new Date(),
      });
    }

    if (walletAmount > 0) {
      await this.deps.walletService.addTransaction(
        userId,
        GLOBAL_COMMUNITY_ID,
        'debit',
        walletAmount,
        'personal',
        'document_variant_proposal',
        variantId,
        feeCurrency,
        'Fee for proposing a document variant',
      );
    }
  }

  private async notifyVariantProposed(
    variant: DocumentBlockVariantSchemaClass,
    doc: MeriterDocumentSchemaClass,
    community: Community,
  ): Promise<void> {
    const leads = await this.deps.userCommunityRoleService.getUsersByRole(doc.communityId, 'lead');
    const recipientIds = new Set<string>([doc.createdBy, ...leads.map((r) => r.userId)]);
    recipientIds.delete(variant.proposedBy);

    if (recipientIds.size === 0) {
      return;
    }

    const title = doc.title?.trim() || 'Document';
    const metadata = {
      ...buildDocumentNotificationMetadata(doc, community, variant.blockId),
      variantId: variant.id,
      proposedBy: variant.proposedBy,
    };

    for (const userId of recipientIds) {
      await this.deps.notificationService.createNotification({
        userId,
        type: 'document_variant_proposed',
        source: 'user',
        sourceId: variant.proposedBy,
        metadata,
        title: 'New variant proposal',
        message: `A new variant was proposed on "${title}".`,
      });
    }
  }

  private async canManageDocumentForProposal(
    userId: string,
    doc: MeriterDocumentSchemaClass,
    community: Community,
  ): Promise<boolean> {
    const user = await this.deps.userService.getUserById(userId);
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return true;
    }
    if (doc.createdBy === userId) {
      return true;
    }
    return this.deps.communityService.isUserAdmin(community.id, userId);
  }
}

export function createProposeDocumentVariantUseCase(
  deps: ProposeDocumentVariantDeps,
): ProposeDocumentVariantUseCase {
  return new ProposeDocumentVariantUseCase(deps);
}

function assertDocumentsModeAllowsDocument(community: Community, docType: MeriterDocType): void {
  const mode = community.settings?.documentsMode ?? 'visionOrDescriptionOnly';
  if (mode === 'off') {
    throw new ForbiddenException('Collaborative documents are disabled in this community');
  }
  if (mode === 'visionOrDescriptionOnly' && docType === 'custom') {
    throw new ForbiddenException('Custom documents are not enabled for this community');
  }
}

async function assertCanAccessDocumentForProposal(
  deps: ProposeDocumentVariantDeps,
  userId: string,
  community: Community,
  doc: MeriterDocumentSchemaClass,
): Promise<void> {
  const user = await deps.userService.getUserById(userId);
  if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
    return;
  }

  const role = await deps.userCommunityRoleService.getRole(userId, community.id);
  if (!role) {
    throw new ForbiddenException('You must be a community member to propose a variant');
  }

  const canPropose = await deps.permissionService.canProposeDocumentVariant(userId, doc.id);
  if (!canPropose) {
    throw new ForbiddenException('You are not allowed to propose a variant on this document');
  }

  if (doc.type !== 'custom') {
    return;
  }

  const creators = community.settings?.documentCreators ?? 'admins';
  if (creators === 'members') {
    return;
  }

  const admin = await deps.communityService.isUserAdmin(community.id, userId);
  if (!admin) {
    throw new ForbiddenException('Only community admins can propose variants on custom documents');
  }
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
