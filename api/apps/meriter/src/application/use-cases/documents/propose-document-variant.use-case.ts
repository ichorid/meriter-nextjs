import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import {
  normalizeDocumentVariantReferences,
  type DocumentVariantReferenceInput,
} from '../../../domain/common/document-variant-references.util';
import type { Community } from '../../../domain/models/community/community.schema';
import type {
  DocumentBlockVariantSchemaClass,
  DocumentBlockVariantDocument,
} from '../../../domain/models/document-block-variant/document-block-variant.schema';
import type {
  MeriterDocumentSchemaClass,
  MeriterDocType,
} from '../../../domain/models/meriter-document/meriter-document.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { DocumentService } from '../../../domain/services/document.service';
import type { NotificationService } from '../../../domain/services/notification.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import { sanitizeDocumentHtml } from '../../../common/utils/sanitize-document-html';
import {
  createGetRemainingQuotaUseCase,
  type CommunityQuotaContext,
} from '../wallets/get-remaining-quota.use-case';

export type { DocumentVariantReferenceInput };

const MAX_VARIANT_CONTENT = 5000;

export type ProposeDocumentVariantInput = {
  documentId: string;
  blockId: string;
  content: string;
  references?: DocumentVariantReferenceInput[];
};

export type ProposeDocumentVariantDeps = {
  documentService: DocumentService;
  variantModel: Model<DocumentBlockVariantDocument>;
  communityService: CommunityService;
  walletService: WalletService;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  notificationService: NotificationService;
  permissionService: PermissionService;
  connection: Connection;
  finalizeExpiredWaveOnBlock: (documentId: string, blockId: string) => Promise<void>;
};

/**
 * BC-06: propose a document block variant (§12.1).
 * inv-01: variantCost debited from quota and/or GLOBAL_COMMUNITY_ID wallet.
 */
export class ProposeDocumentVariantUseCase {
  private readonly logger = new Logger(ProposeDocumentVariantUseCase.name);
  private readonly getRemainingQuota = createGetRemainingQuotaUseCase({
    communityService: this.deps.communityService,
  });

  constructor(private readonly deps: ProposeDocumentVariantDeps) {}

  async execute(
    userId: string,
    input: ProposeDocumentVariantInput,
  ): Promise<DocumentBlockVariantSchemaClass> {
    const content = sanitizeDocumentHtml(input.content ?? '');
    if (!content) {
      throw new BadRequestException('Variant content is required');
    }
    if (content.length > MAX_VARIANT_CONTENT) {
      throw new BadRequestException(
        `Variant content must be at most ${MAX_VARIANT_CONTENT} characters`,
      );
    }

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

    const block = this.deps.documentService.findBlock(doc, input.blockId);
    if (!block) {
      throw new NotFoundException('Block not found');
    }

    if (block.proposalsLocked === true) {
      const canEditStructure = await this.deps.permissionService.canEditDocumentStructure(
        userId,
        doc.id,
      );
      if (!canEditStructure) {
        throw new ForbiddenException('This block is locked; you cannot propose changes');
      }
    }

    await this.deps.finalizeExpiredWaveOnBlock(doc.id, input.blockId);

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

    const blockAfter = this.deps.documentService.findBlock(doc, input.blockId);
    const needsWaveStart = !blockAfter?.currentWaveStartedAt;
    if (needsWaveStart) {
      await this.deps.documentService.updateDocumentBlock(doc.id, input.blockId, (b) => {
        b.currentWaveStartedAt = now;
        b.officialRating = 0;
      });
    }

    await this.deps.variantModel.create({
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

    const created = await this.deps.variantModel.findOne({ id: variantId }).lean().exec();
    if (created) {
      await this.notifyVariantProposed(created as DocumentBlockVariantSchemaClass, doc, community).catch(
        (err) => {
          this.logger.warn(
            `Failed to notify new variant proposal ${variantId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        },
      );
    }
    return created as DocumentBlockVariantSchemaClass;
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
