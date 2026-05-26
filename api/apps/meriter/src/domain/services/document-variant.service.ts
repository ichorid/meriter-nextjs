import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import {
  DOCUMENT_WAVE_FINALIZE_LOCKS_COLLECTION,
  documentWaveFinalizeLockId,
} from '../common/constants/document-wave-lock.constants';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import { GLOBAL_ROLE_SUPERADMIN } from '../common/constants/roles.constants';
import type { Community } from '../models/community/community.schema';
import {
  DocumentBlockVariantSchemaClass,
  DocumentBlockVariantDocument,
} from '../models/document-block-variant/document-block-variant.schema';
import {
  MeriterDocumentSchemaClass,
  MeriterDocType,
} from '../models/meriter-document/meriter-document.schema';
import { CommunityService } from './community.service';
import { DocumentService } from './document.service';
import { NotificationService } from './notification.service';
import { PermissionService } from './permission.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { WalletService } from './wallet.service';
import { getRemainingQuotaForPublicationCreate } from '../../trpc/helpers/publication-creation-quota';
import { MERITER_DOCUMENT_AUTO_APPLY_USER_ID } from '../common/constants/meriter-actors.constant';
import { sanitizeDocumentHtml } from '../../common/utils/sanitize-document-html';
import {
  normalizeDocumentVariantReferences,
  type DocumentVariantReferenceInput,
} from '../common/document-variant-references.util';

export type { DocumentVariantReferenceInput };

const MAX_VARIANT_CONTENT = 5000;

@Injectable()
export class DocumentVariantService {
  private readonly logger = new Logger(DocumentVariantService.name);

  constructor(
    private readonly documentService: DocumentService,
    @InjectModel(DocumentBlockVariantSchemaClass.name)
    private readonly variantModel: Model<DocumentBlockVariantDocument>,
    private readonly communityService: CommunityService,
    private readonly walletService: WalletService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly permissionService: PermissionService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async listByBlock(documentId: string, blockId: string): Promise<DocumentBlockVariantSchemaClass[]> {
    return this.variantModel
      .find({
        documentId,
        blockId,
        deleted: false,
      })
      .sort({ proposedAt: -1 })
      .lean()
      .exec() as Promise<DocumentBlockVariantSchemaClass[]>;
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
    const lockId = documentWaveFinalizeLockId(documentId, blockId);
    const locks = this.connection.db?.collection(DOCUMENT_WAVE_FINALIZE_LOCKS_COLLECTION);
    if (!locks) {
      await this.finalizeExpiredWaveOnBlockCore(documentId, blockId, options);
      return;
    }
    const acquired = await locks.updateOne(
      { lockId },
      { $setOnInsert: { lockId, createdAt: new Date() } },
      { upsert: true },
    );
    if (!acquired.upsertedCount) {
      return;
    }
    try {
      await this.finalizeExpiredWaveOnBlockCore(documentId, blockId, options);
    } finally {
      await locks.deleteOne({ lockId }).catch(() => undefined);
    }
  }

  private async finalizeExpiredWaveOnBlockCore(
    documentId: string,
    blockId: string,
    options?: { force?: boolean },
  ): Promise<void> {
    const docLean = await this.documentService.getById(documentId);
    if (!docLean) {
      return;
    }
    if (
      !options?.force &&
      this.documentService.isDocumentBlockVotingOpen(docLean, blockId)
    ) {
      return;
    }

    const openVariants = await this.variantModel
      .find({
        documentId,
        blockId,
        status: 'open',
        deleted: false,
      })
      .lean()
      .exec();

    if (openVariants.length === 0) {
      await this.documentService.updateDocumentBlock(documentId, blockId, (b) => {
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

    const block = this.documentService.findBlock(docLean, blockId);
    const officialRating = block?.officialRating ?? 0;
    const topVariant = openVariants[0]!;
    const topVariantRating = topVariant?.rating ?? 0;
    const officialWins =
      officialRating > topVariantRating ||
      (officialRating === topVariantRating && officialRating > 0);

    if (officialWins) {
      for (const v of openVariants) {
        await this.variantModel.updateOne(
          { id: v.id },
          {
            $set: {
              status: 'closed-not-winner',
              updatedAt: new Date(),
            },
          },
        );
      }
      await this.documentService.updateDocumentBlock(documentId, blockId, (b) => {
        delete b.currentWaveStartedAt;
        b.officialRating = 0;
      });
      return;
    }

    const top = topVariant;
    const topRated = topVariantRating > 0;

    for (const v of openVariants) {
      const isWinner = topRated && v.id === top.id;
      await this.variantModel.updateOne(
        { id: v.id },
        {
          $set: {
            status: isWinner ? 'closed-winner' : 'closed-not-winner',
            updatedAt: new Date(),
          },
        },
      );
    }

    await this.documentService.updateDocumentBlock(documentId, blockId, (b) => {
      delete b.currentWaveStartedAt;
      b.officialRating = 0;
    });

    if (topRated && docLean.mode !== 'auto') {
      await this.notifyVariantWon(top, docLean).catch((err) => {
        this.logger.warn(
          `Failed to notify variant winner ${top.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    await this.tryAutoApplyWinner(documentId, blockId);
  }

  /**
   * Cron / sweep: close expired waves on all blocks that still have open variants.
   */
  async runPeriodicWaveSweep(): Promise<void> {
    const pairs = await this.variantModel
      .aggregate<{ _id: { d: string; b: string } }>([
        { $match: { status: 'open', deleted: false } },
        { $group: { _id: { d: '$documentId', b: '$blockId' } } },
      ])
      .exec();

    for (const p of pairs) {
      const documentId = p._id.d;
      const blockId = p._id.b;
      try {
        const doc = await this.documentService.getById(documentId);
        if (!doc) {
          continue;
        }
        if (this.documentService.isDocumentBlockVotingOpen(doc, blockId)) {
          continue;
        }
        await this.finalizeExpiredWaveOnBlock(documentId, blockId);
      } catch (err) {
        this.logger.warn(
          `Wave sweep failed ${documentId}/${blockId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async proposeVariant(
    userId: string,
    input: {
      documentId: string;
      blockId: string;
      content: string;
      references?: DocumentVariantReferenceInput[];
    },
  ): Promise<DocumentBlockVariantSchemaClass> {
    const content = sanitizeDocumentHtml(input.content ?? '');
    if (!content) {
      throw new BadRequestException('Variant content is required');
    }
    if (content.length > MAX_VARIANT_CONTENT) {
      throw new BadRequestException(`Variant content must be at most ${MAX_VARIANT_CONTENT} characters`);
    }

    let doc = await this.documentService.getById(input.documentId);
    if (!doc || doc.deleted || doc.status !== 'active') {
      throw new NotFoundException('Document not found');
    }

    const community = await this.communityService.getCommunity(doc.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    this.assertDocumentsModeAllowsDocument(community, doc.type);
    await this.assertCanAccessDocumentForProposal(userId, community, doc);

    const block = this.documentService.findBlock(doc, input.blockId);
    if (!block) {
      throw new NotFoundException('Block not found');
    }

    if (block.proposalsLocked === true) {
      const canEditStructure = await this.permissionService.canEditDocumentStructure(
        userId,
        doc.id,
      );
      if (!canEditStructure) {
        throw new ForbiddenException('This block is locked; you cannot propose changes');
      }
    }

    await this.finalizeExpiredWaveOnBlock(doc.id, input.blockId);

    doc = (await this.documentService.getById(input.documentId))!;
    const dup = await this.variantModel.findOne({
      documentId: doc.id,
      blockId: input.blockId,
      proposedBy: userId,
      status: 'open',
      deleted: false,
    });
    if (dup) {
      throw new BadRequestException('You already have an open variant on this block');
    }

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

    const blockAfter = this.documentService.findBlock(doc, input.blockId);
    const needsWaveStart = !blockAfter?.currentWaveStartedAt;
    if (needsWaveStart) {
      await this.documentService.updateDocumentBlock(doc.id, input.blockId, (b) => {
        b.currentWaveStartedAt = now;
        b.officialRating = 0;
      });
    }

    await this.variantModel.create({
      id: variantId,
      documentId: doc.id,
      blockId: input.blockId,
      content,
      references: refs,
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

    const created = await this.variantModel.findOne({ id: variantId }).lean().exec();
    return created as DocumentBlockVariantSchemaClass;
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
    await this.variantModel.updateOne(
      { id: variantId },
      { $set: { status: 'withdrawn', updatedAt: new Date() } },
    );
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

    const pending = await this.variantModel
      .find({
        documentId,
        blockId,
        deleted: false,
        status: { $in: ['open', 'closed-winner', 'closed-not-winner'] },
      })
      .lean()
      .exec();

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
    await this.variantModel.updateMany(
      {
        documentId,
        blockId,
        deleted: false,
        status: { $in: ['closed-winner', 'closed-not-winner'] },
      },
      { $set: { status: 'withdrawn', updatedAt: now } },
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

    const openVariantsBeforeOverride = await this.variantModel
      .find({
        documentId: doc.id,
        blockId,
        status: 'open',
        deleted: false,
      })
      .lean()
      .exec();

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

    await this.variantModel.updateMany(
      {
        documentId: doc.id,
        blockId,
        status: 'open',
        deleted: false,
      },
      { $set: { status: 'closed-not-winner', updatedAt: now } },
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
    await this.variantModel.updateOne(
      { id: variantId },
      { $set: { deleted: true, updatedAt: new Date() } },
    );
  }

  private async applyVariantToOfficial(
    actorUserId: string,
    v: DocumentBlockVariantSchemaClass,
    doc: MeriterDocumentSchemaClass,
    reason: 'vote' | 'admin',
  ): Promise<void> {
    const now = new Date();
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

    await this.variantModel.updateMany(
      {
        documentId: doc.id,
        blockId: v.blockId,
        id: { $ne: v.id },
        status: 'open',
        deleted: false,
      },
      { $set: { status: 'closed-not-winner', updatedAt: now } },
    );

    await this.variantModel.updateOne(
      { id: v.id },
      {
        $set: {
          status: 'applied',
          appliedAt: now,
          appliedBy: actorUserId,
          updatedAt: now,
        },
      },
    );

    await this.documentService.mirrorOfficialTextToCommunityIfApplicable(doc.id);

    const community = await this.communityService.getCommunity(doc.communityId);
    if (community) {
      await this.notifyVariantApplied(v, doc, community).catch((err) => {
        this.logger.warn(
          `Failed to notify variant applied ${v.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }

  /** Auto-apply closed winner when document is in auto mode (§12.2). */
  private async tryAutoApplyWinner(documentId: string, blockId: string): Promise<void> {
    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted || doc.mode !== 'auto') {
      return;
    }
    const winner = await this.variantModel
      .findOne({
        documentId,
        blockId,
        status: 'closed-winner',
        deleted: false,
      })
      .lean()
      .exec();
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

  private async assertCanAccessDocumentForProposal(
    userId: string,
    community: Community,
    doc: MeriterDocumentSchemaClass,
  ): Promise<void> {
    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return;
    }

    const role = await this.userCommunityRoleService.getRole(userId, community.id);
    if (!role) {
      throw new ForbiddenException('You must be a community member to propose a variant');
    }

    const canPropose = await this.permissionService.canProposeDocumentVariant(
      userId,
      doc.id,
    );
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

    const admin = await this.communityService.isUserAdmin(community.id, userId);
    if (!admin) {
      throw new ForbiddenException('Only community admins can propose variants on custom documents');
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

    if (canPayFromQuota) {
      const remainingQuota = await getRemainingQuotaForPublicationCreate(
        userId,
        communityId,
        community,
        this.communityService,
        this.connection,
      );
      quotaAmount = Math.min(variantCost, remainingQuota);
      walletAmount = Math.max(0, variantCost - quotaAmount);
    } else {
      walletAmount = variantCost;
    }

    if (walletAmount > 0) {
      const wallet = await this.walletService.getWallet(userId, GLOBAL_COMMUNITY_ID);
      const bal = wallet ? wallet.getBalance() : 0;
      if (bal < walletAmount) {
        throw new BadRequestException(
          `Insufficient wallet merits. Available: ${bal}, Required: ${walletAmount}`,
        );
      }
    }

    if (quotaAmount > 0) {
      const remainingQuota = await getRemainingQuotaForPublicationCreate(
        userId,
        communityId,
        community,
        this.communityService,
        this.connection,
      );
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
    const currency =
      community.settings?.currencyNames ?? {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };
    const globalCommunity = await this.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
    const feeCurrency = globalCommunity?.settings?.currencyNames ?? currency;

    if (quotaAmount > 0 && this.connection.db) {
      await this.connection.db.collection('quota_usage').insertOne({
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
      await this.walletService.addTransaction(
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
