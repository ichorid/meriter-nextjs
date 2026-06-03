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
  buildBlockPlainSegments,
  editChangeOverlapsLocked,
  findPlainTextChangeBounds,
  insertBlocksAfterInSection,
  isAppendNewBlocksAtEnd,
  mapGlobalPlainRangeToBlock,
  proposedEditOverlapsLocked,
  sanitizeProposedHtmlFragment,
  splitSectionBlockForProposalRange,
  type BlockPlainSegment,
  type SectionBlockRow,
} from '../../../domain/common/document-block-structure.util';
import {
  assertNoOverlapWithOpenRanges,
  buildMergedBlockPreviewContent,
  hashBlockOfficialAtPropose,
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

    const officialHtml = String(block.officialContent ?? '');
    const plainLen = blockHtmlToPlainText(officialHtml).length;
    const hasRange = prepared.hasRange;
    const rangeStart = prepared.rangeStart;
    const rangeEnd = prepared.rangeEnd;
    const proposedText = prepared.proposedText;
    let content = prepared.content;

    if (hasRange && rangeStart !== undefined && rangeEnd !== undefined) {
      const openOnBlock = await this.deps.documentPersistence.findOpenVariants(doc.id, blockId);
      try {
        assertNoOverlapWithOpenRanges(rangeStart, rangeEnd, openOnBlock, officialHtml);
      } catch (err) {
        if (err instanceof Error && err.message === 'RANGE_OVERLAP') {
          throw new ConflictException(
            'This range overlaps an open proposal on the same block',
          );
        }
        throw err;
      }
      content = buildMergedBlockPreviewContent(
        officialHtml,
        rangeStart,
        rangeEnd,
        proposedText,
      );
    }

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
    const lockedSpans = getEffectiveLockedRanges(
      plainLen,
      block.proposalsLocked === true,
      block.lockedRanges as Array<{ rangeStart: number; rangeEnd: number }> | undefined,
    );
    if (!canManageDocument && lockedSpans.length > 0) {
      if (block.proposalsLocked === true) {
        throw new ForbiddenException('This block is locked; you cannot propose changes');
      }
      if (hasRange && rangeStart !== undefined && rangeEnd !== undefined) {
        if (proposedEditOverlapsLocked(rangeStart, rangeEnd, lockedSpans)) {
          throw new ForbiddenException(
            'This range overlaps text pinned by an administrator',
          );
        }
      } else {
        const oldPlain = blockHtmlToPlainText(officialHtml);
        const newPlain = blockHtmlToPlainText(content);
        if (editChangeOverlapsLocked(oldPlain, newPlain, lockedSpans)) {
          throw new ForbiddenException(
            'Your proposal would change text pinned by an administrator',
          );
        }
      }
    }

    const officialTextHashAtPropose = hashBlockOfficialAtPropose(officialHtml);

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

    const created = await this.deps.documentPersistence.insertVariant({
      id: variantId,
      documentId: doc.id,
      blockId,
      content,
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
    hasRange: boolean;
    rangeStart?: number;
    rangeEnd?: number;
    proposedText?: string;
    content: string;
  }> {
    const located = this.locateBlockInDocument(doc, input.blockId);
    if (!located) {
      throw new NotFoundException('Block not found');
    }

    const orderedBlocks = this.collectAllDocumentBlocks(located.allSections);
    const { joinedHtml, joinedPlain, segments } = buildBlockPlainSegments(
      orderedBlocks.map((b) => ({ id: b.id, officialContent: b.officialContent })),
    );

    const inputHasRange =
      input.rangeStart !== undefined &&
      input.rangeEnd !== undefined &&
      input.proposedText !== undefined;

    if (inputHasRange) {
      const proposedText = sanitizeProposedHtmlFragment(input.proposedText ?? '');
      if (!proposedText && input.rangeEnd! <= input.rangeStart!) {
        throw new BadRequestException('Proposed text is required for a range variant');
      }
      const previewJoinedHtml = buildJoinedHtmlAfterGlobalRange(
        segments,
        input.rangeStart!,
        input.rangeEnd!,
        proposedText,
      );
      const appendParsed = isAppendNewBlocksAtEnd(joinedHtml, previewJoinedHtml);
      if (appendParsed && appendParsed.length > 0) {
        const afterId = segments[segments.length - 1]!.blockId;
        const inserted = insertBlocksAfterInSection(located.blocks, afterId, appendParsed);
        await this.persistDocumentSections(doc.id, located, inserted.blocks);
        doc = (await this.deps.documentService.getById(doc.id))!;
        const newId = inserted.newBlockIds[0]!;
        const newHtml = appendParsed[0]!.officialContent;
        return {
          doc,
          blockId: newId,
          hasRange: false,
          content: sanitizeDocumentHtml(newHtml),
        };
      }

      const mapped = mapGlobalPlainRangeToBlock(
        segments,
        input.rangeStart!,
        input.rangeEnd!,
      );
      if (!mapped) {
        throw new BadRequestException('Proposal range is outside the document');
      }
      const split = splitSectionBlockForProposalRange(
        located.blocks,
        mapped.blockId,
        mapped.localStart,
        mapped.localEnd,
      );
      if (split.blocks !== located.blocks) {
        await this.persistDocumentSections(doc.id, located, split.blocks);
        doc = (await this.deps.documentService.getById(doc.id))!;
      }
      const target = this.deps.documentService.findBlock(doc, split.targetBlockId);
      const targetHtml = String(target?.officialContent ?? '');
      const plainLen = blockHtmlToPlainText(targetHtml).length;
      const bounds = normalizeRangeBounds(plainLen, split.localStart, split.localEnd);
      return {
        doc,
        blockId: split.targetBlockId,
        hasRange: true,
        rangeStart: bounds.rangeStart,
        rangeEnd: bounds.rangeEnd,
        proposedText,
        content: buildMergedBlockPreviewContent(
          targetHtml,
          bounds.rangeStart,
          bounds.rangeEnd,
          proposedText,
        ),
      };
    }

    const content = sanitizeDocumentHtml(input.content ?? '');
    if (!content) {
      throw new BadRequestException('Variant content is required');
    }

    const appendParsed = isAppendNewBlocksAtEnd(joinedHtml, content);
    if (appendParsed && appendParsed.length > 0) {
      const afterId = segments[segments.length - 1]!.blockId;
      const inserted = insertBlocksAfterInSection(located.blocks, afterId, appendParsed);
      await this.persistDocumentSections(doc.id, located, inserted.blocks);
      doc = (await this.deps.documentService.getById(doc.id))!;
      const newId = inserted.newBlockIds[0]!;
      return {
        doc,
        blockId: newId,
        hasRange: false,
        content: sanitizeDocumentHtml(appendParsed[0]!.officialContent),
      };
    }

    const bounds = findPlainTextChangeBounds(joinedPlain, blockHtmlToPlainText(content));
    if (bounds && bounds.proposedText.trim()) {
      const proposedText = sanitizeProposedHtmlFragment(bounds.proposedText);
      if (proposedText) {
        const mapped = mapGlobalPlainRangeToBlock(
          segments,
          bounds.rangeStart,
          bounds.rangeEnd,
        );
        if (mapped) {
          const split = splitSectionBlockForProposalRange(
            located.blocks,
            mapped.blockId,
            mapped.localStart,
            mapped.localEnd,
          );
          if (split.blocks !== located.blocks) {
            await this.persistDocumentSections(doc.id, located, split.blocks);
            doc = (await this.deps.documentService.getById(doc.id))!;
          }
          const target = this.deps.documentService.findBlock(doc, split.targetBlockId);
          const targetHtml = String(target?.officialContent ?? '');
          const plainLen = blockHtmlToPlainText(targetHtml).length;
          const local = normalizeRangeBounds(plainLen, split.localStart, split.localEnd);
          return {
            doc,
            blockId: split.targetBlockId,
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
      }
    }

    const mapped = mapGlobalPlainRangeToBlock(
      segments,
      bounds?.rangeStart ?? 0,
      bounds?.rangeEnd ?? joinedPlain.length,
    );
    const blockId = mapped?.blockId ?? input.blockId;
    return { doc, blockId, hasRange: false, content };
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

  private async persistDocumentSections(
    documentId: string,
    located: {
      allSections: Array<{ order?: number; blocks?: SectionBlockRow[] }>;
      sectionIndex: number;
    },
    sectionBlocks: SectionBlockRow[],
  ): Promise<void> {
    const sections = located.allSections;
    sections[located.sectionIndex]!.blocks = sectionBlocks;
    const result = await this.deps.documentService.updateSections(documentId, sections);
    if (!result.ok) {
      throw new ConflictException('Document was updated by someone else; refresh and try again');
    }
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

function buildJoinedHtmlAfterGlobalRange(
  segments: BlockPlainSegment[],
  globalStart: number,
  globalEnd: number,
  proposedHtml: string,
): string {
  const mapped = mapGlobalPlainRangeToBlock(segments, globalStart, globalEnd);
  if (!mapped) {
    throw new BadRequestException('Proposal range is outside the document');
  }
  let html = '';
  for (const seg of segments) {
    if (seg.blockId === mapped.blockId) {
      html += buildMergedBlockPreviewContent(
        seg.html,
        mapped.localStart,
        mapped.localEnd,
        proposedHtml,
      );
    } else {
      html += seg.html;
    }
  }
  return html;
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
