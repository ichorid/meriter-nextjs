import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { randomUUID } from 'crypto';
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
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { WalletService } from './wallet.service';
import { getRemainingQuotaForPublicationCreate } from '../../trpc/helpers/publication-creation-quota';
import { MERITER_DOCUMENT_AUTO_APPLY_USER_ID } from '../common/constants/meriter-actors.constant';

const MAX_VARIANT_CONTENT = 5000;
const MAX_REFERENCE_SUMMARY = 280;

export interface DocumentVariantReferenceInput {
  id?: string;
  url: string;
  summary: string;
  stance?: 'pro' | 'con';
}

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
  async finalizeExpiredWaveOnBlock(documentId: string, blockId: string): Promise<void> {
    const docLean = await this.documentService.getById(documentId);
    if (!docLean) {
      return;
    }
    if (this.documentService.isDocumentBlockVotingOpen(docLean, blockId)) {
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

    const top = openVariants[0]!;
    const topRated = (top.rating ?? 0) > 0;

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
    });

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
    const content = input.content?.trim() ?? '';
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

    const refs = this.normalizeReferences(input.references);

    const variantId = uid();
    const now = new Date();

    const blockAfter = this.documentService.findBlock(doc, input.blockId);
    const needsWaveStart = !blockAfter?.currentWaveStartedAt;
    if (needsWaveStart) {
      await this.documentService.updateDocumentBlock(doc.id, input.blockId, (b) => {
        b.currentWaveStartedAt = now;
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

  private async applyVariantToOfficial(
    actorUserId: string,
    v: DocumentBlockVariantSchemaClass,
    doc: MeriterDocumentSchemaClass,
    reason: 'vote' | 'admin',
  ): Promise<void> {
    const now = new Date();
    const ok = await this.documentService.updateDocumentBlock(doc.id, v.blockId, (b) => {
      b.officialContent = v.content;
      b.officialContentSetAt = now;
      b.officialContentSetBy = actorUserId;
      b.officialContentReason = reason;
      if (reason === 'vote') {
        b.officialContentVariantId = v.id;
      } else {
        delete b.officialContentVariantId;
      }
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

  private async assertCanManageDocument(
    userId: string,
    doc: MeriterDocumentSchemaClass,
  ): Promise<void> {
    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return;
    }
    if (doc.createdBy === userId) {
      return;
    }
    const admin = await this.communityService.isUserAdmin(doc.communityId, userId);
    if (!admin) {
      throw new ForbiddenException('Only the document author or a community admin can apply variants');
    }
  }

  private normalizeReferences(
    refs: DocumentVariantReferenceInput[] | undefined,
  ): Array<{ id: string; url: string; summary: string; stance?: 'pro' | 'con' }> {
    if (!refs?.length) {
      return [];
    }
    const out: Array<{ id: string; url: string; summary: string; stance?: 'pro' | 'con' }> = [];
    for (const r of refs.slice(0, 10)) {
      let url: URL;
      try {
        url = new URL(r.url);
      } catch {
        throw new BadRequestException(`Invalid reference URL: ${r.url}`);
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new BadRequestException('Reference URL must be http(s)');
      }
      const summary = (r.summary ?? '').trim();
      if (summary.length > MAX_REFERENCE_SUMMARY) {
        throw new BadRequestException(`Reference summary must be at most ${MAX_REFERENCE_SUMMARY} characters`);
      }
      out.push({
        id: r.id ?? randomUUID(),
        url: r.url.trim(),
        summary,
        stance: r.stance,
      });
    }
    return out;
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
}
