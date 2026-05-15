import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type ClientSession } from 'mongoose';
import { randomUUID } from 'crypto';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import { shouldBootstrapImageOfFutureDocument } from '../common/constants/collaborative-documents.constants';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../models/community/community.schema';
import type { CommunitySettings } from '../models/community/community.schema';
import {
  MeriterDocumentSchemaClass,
  MeriterDocumentDocument,
  MeriterDocApplyMode,
  MeriterDocType,
  OfficialContentReason,
} from '../models/meriter-document/meriter-document.schema';
import {
  DocumentBlockVariantSchemaClass,
  DocumentBlockVariantDocument,
} from '../models/document-block-variant/document-block-variant.schema';
import { PublicationService } from './publication.service';

type MirrorField = 'futureVisionText' | 'description';

interface SectionLike {
  order: number;
  title?: string;
  blocks: BlockLike[];
}

interface BlockLike {
  order: number;
  officialContent?: string;
}

export interface BlockEditHistoryEntry {
  changedAt: Date;
  changedBy: string;
  reason: OfficialContentReason;
  variantId?: string;
  previousContent: string;
}

/**
 * Совместные документы (ОБ, описание проекта, кастомные — позже).
 * @see docs/prd/shared-document/business-approved-tz.md
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    @InjectModel(MeriterDocumentSchemaClass.name)
    private readonly documentModel: Model<MeriterDocumentDocument>,
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
    @InjectModel(DocumentBlockVariantSchemaClass.name)
    private readonly variantModel: Model<DocumentBlockVariantDocument>,
    @Inject(forwardRef(() => PublicationService))
    private readonly publicationService: PublicationService,
  ) {}

  /**
   * Strip TipTap/HTML from block text when syncing to community `futureVisionText` / `description` (plain §5.3).
   */
  private stripHtmlForMirror(raw: string): string {
    let s = (raw ?? '').trim();
    if (!s) return '';
    if (!/<[a-z][\s\S]*>/i.test(s) && !/<\/[a-z]+>/i.test(s)) {
      return s;
    }
    s = s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    return s
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\r?\n\s*\r?\n+/g, '\n\n')
      .trim();
  }

  /** Plain text для legacy-полей сообщества (§5.3 ТЗ). */
  concatOfficialPlainText(sections: SectionLike[]): string {
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    const chunks: string[] = [];
    for (const sec of sortedSections) {
      const sortedBlocks = [...sec.blocks].sort((a, b) => a.order - b.order);
      const body = sortedBlocks
        .map((b) => this.stripHtmlForMirror(b.officialContent ?? ''))
        .filter(Boolean)
        .join('\n\n');
      if (sec.title?.trim()) {
        chunks.push(`\n\n# ${sec.title.trim()}\n\n${body}`);
      } else {
        chunks.push(body);
      }
    }
    return chunks.join('').trim();
  }

  /**
   * Backfill official ОБ / описание documents for communities created before collaborative docs
   * or when rows were never inserted. Idempotent (ensureOfficialDocument skips if exists).
   */
  async ensureOfficialDocumentsForCommunity(communityId: string): Promise<void> {
    if (!communityId || communityId === GLOBAL_COMMUNITY_ID) {
      return;
    }
    const community = await this.communityModel.findOne({ id: communityId }).lean();
    if (!community) {
      return;
    }
    const c = community as Record<string, unknown>;
    const typeTag = c.typeTag as string | undefined;
    if (typeTag === 'global') {
      return;
    }
    await this.bootstrapForNewCommunity({
      communityId,
      typeTag,
      isProject: Boolean(c.isProject),
      createdByUserId: typeof c.createdByUserId === 'string' ? c.createdByUserId : 'system',
      futureVisionText:
        typeof c.futureVisionText === 'string' ? c.futureVisionText : undefined,
      description: typeof c.description === 'string' ? c.description : undefined,
    });
  }

  async bootstrapForNewCommunity(params: {
    communityId: string;
    typeTag?: string;
    isProject?: boolean;
    createdByUserId: string;
    futureVisionText?: string;
    description?: string;
  }): Promise<{ documentsCreated: number }> {
    let documentsCreated = 0;
    if (
      params.communityId === GLOBAL_COMMUNITY_ID ||
      params.typeTag === 'global'
    ) {
      return { documentsCreated: 0 };
    }

    try {
      if (shouldBootstrapImageOfFutureDocument(params.typeTag)) {
        if (
          await this.ensureOfficialDocument({
            communityId: params.communityId,
            type: 'imageOfFuture',
            title: 'Образ будущего',
            createdBy: params.createdByUserId,
            initialParagraph: params.futureVisionText ?? '',
            mirrorField: 'futureVisionText',
          })
        ) {
          documentsCreated += 1;
        }
      }

      if (params.isProject) {
        if (
          await this.ensureOfficialDocument({
            communityId: params.communityId,
            type: 'description',
            title: 'Описание проекта',
            createdBy: params.createdByUserId,
            initialParagraph: params.description ?? '',
            mirrorField: 'description',
          })
        ) {
          documentsCreated += 1;
        }
      }
    } catch (error) {
      this.logger.error(
        `bootstrapForNewCommunity failed for ${params.communityId}: ${error instanceof Error ? error.message : error}`,
      );
    }
    return { documentsCreated };
  }

  private async ensureOfficialDocument(args: {
    communityId: string;
    type: MeriterDocType;
    title: string;
    createdBy: string;
    initialParagraph: string;
    mirrorField: MirrorField;
  }): Promise<boolean> {
    const existing = await this.documentModel
      .findOne({
        communityId: args.communityId,
        type: args.type,
        deleted: false,
      })
      .lean();
    if (existing) {
      return false;
    }

    const community = await this.communityModel
      .findOne({ id: args.communityId })
      .lean();
    const settings = (community?.settings ?? {}) as CommunitySettings;
    const postCost = settings.postCost ?? 1;
    const variantCostOverride = settings.documentVariantCost;
    const variantCost =
      variantCostOverride === null || variantCostOverride === undefined
        ? postCost
        : variantCostOverride;
    const votingDurationHours = settings.documentVotingDurationHours ?? 48;
    const mode = settings.documentDefaultMode ?? 'manual';
    const allowDownvotes = true;

    const sectionId = randomUUID();
    const blockId = randomUUID();
    const now = new Date();

    const documentId = uid();
    const docPayload = {
      id: documentId,
      communityId: args.communityId,
      type: args.type,
      title: args.title,
      sections: [
        {
          id: sectionId,
          title: '',
          order: 0,
          blocks: [
            {
              id: blockId,
              order: 0,
              blockType: 'paragraph',
              officialContent: args.initialParagraph,
              officialContentSetAt: now,
              officialContentSetBy: args.createdBy,
              officialContentReason: 'initial' as const,
              editHistory: [],
            },
          ],
        },
      ],
      mode,
      votingDurationHours,
      variantCost,
      allowDownvotes,
      createdBy: args.createdBy,
      status: 'active' as const,
      deleted: false,
    };

    await this.documentModel.create(docPayload);

    const plain = this.concatOfficialPlainText(
      docPayload.sections.map((sec) => ({
        order: sec.order,
        title: sec.title,
        blocks: sec.blocks.map((b) => ({
          order: b.order,
          officialContent: b.officialContent,
        })),
      })),
    );
    await this.communityModel.updateOne(
      { id: args.communityId },
      { $set: { [args.mirrorField]: plain, updatedAt: new Date() } },
    );
    await this.mirrorOfficialTextToCommunityIfApplicable(documentId);
    return true;
  }

  async listActiveByCommunity(
    communityId: string,
  ): Promise<MeriterDocumentSchemaClass[]> {
    const docs = (await this.documentModel
      .find({
        communityId,
        deleted: false,
        /** Legacy rows may omit `status`; treat as active unless archived */
        $nor: [{ status: 'archived' }],
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as MeriterDocumentSchemaClass[];
    const typeOrder: Record<string, number> = {
      imageOfFuture: 0,
      description: 1,
      custom: 2,
    };
    return [...docs].sort(
      (a, b) =>
        (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99) ||
        (new Date(b.createdAt as Date).getTime() ?? 0) -
          (new Date(a.createdAt as Date).getTime() ?? 0),
    );
  }

  async getById(
    documentId: string,
  ): Promise<MeriterDocumentSchemaClass | null> {
    const doc = await this.documentModel
      .findOne({ id: documentId, deleted: false })
      .lean()
      .exec();
    return doc as MeriterDocumentSchemaClass | null;
  }

  async getOfficialByType(
    communityId: string,
    type: MeriterDocType,
  ): Promise<MeriterDocumentSchemaClass | null> {
    const doc = await this.documentModel
      .findOne({ communityId, type, deleted: false })
      .lean()
      .exec();
    return doc as MeriterDocumentSchemaClass | null;
  }

  async getVariantById(variantId: string): Promise<DocumentBlockVariantSchemaClass | null> {
    const v = await this.variantModel
      .findOne({ id: variantId, deleted: false })
      .lean()
      .exec();
    return v as DocumentBlockVariantSchemaClass | null;
  }

  /**
   * Rating delta from weighted votes (+up / −down). Neutral (0) votes do not change rating.
   */
  async applyRatingDelta(
    variantId: string,
    delta: number,
    session?: ClientSession,
  ): Promise<void> {
    if (!delta) {
      return;
    }
    await this.variantModel.updateOne(
      { id: variantId },
      { $inc: { rating: delta }, $set: { updatedAt: new Date() } },
      session ? { session } : undefined,
    );
  }

  findBlock(
    doc: MeriterDocumentSchemaClass,
    blockId: string,
  ): { currentWaveStartedAt?: Date } | null {
    const sections = doc.sections as Array<{
      blocks?: Array<{ id: string; currentWaveStartedAt?: Date }>;
    }>;
    for (const sec of sections ?? []) {
      for (const b of sec.blocks ?? []) {
        if (b.id === blockId) {
          return b;
        }
      }
    }
    return null;
  }

  /** voting wave active for this block (§13); missing wave anchor → treat as open (legacy). */
  isDocumentBlockVotingOpen(doc: MeriterDocumentSchemaClass, blockId: string): boolean {
    const block = this.findBlock(doc, blockId);
    if (!block) {
      return false;
    }
    const start = block.currentWaveStartedAt;
    if (!start) {
      return true;
    }
    const hours = doc.votingDurationHours ?? 48;
    const startMs =
      start instanceof Date ? start.getTime() : new Date(start as string).getTime();
    const endMs = startMs + hours * 3600 * 1000;
    return Date.now() <= endMs;
  }

  /** Append §19 editHistory entry before mutating `officialContent`. */
  appendBlockEditHistory(
    block: Record<string, unknown>,
    entry: BlockEditHistoryEntry,
  ): void {
    const existing = Array.isArray(block.editHistory)
      ? [...(block.editHistory as BlockEditHistoryEntry[])]
      : [];
    existing.push(entry);
    block.editHistory = existing;
  }

  /** §7.1 — document metadata (caller must enforce `assertCanManageDocument`). */
  async updateMeta(
    documentId: string,
    input: {
      title?: string;
      mode?: MeriterDocApplyMode;
      votingDurationHours?: number;
      variantCost?: number;
      allowDownvotes?: boolean;
    },
  ): Promise<MeriterDocumentSchemaClass> {
    const doc = await this.getById(documentId);
    if (!doc || doc.deleted || doc.status !== 'active') {
      throw new NotFoundException('Document not found');
    }

    const $set: Record<string, unknown> = { updatedAt: new Date() };

    if (input.title !== undefined) {
      if (doc.type !== 'custom') {
        throw new BadRequestException('Title can only be changed for custom documents');
      }
      const title = input.title.trim();
      if (!title) {
        throw new BadRequestException('Title is required');
      }
      $set.title = title;
    }
    if (input.mode !== undefined) {
      $set.mode = input.mode;
    }
    if (input.votingDurationHours !== undefined) {
      $set.votingDurationHours = Math.max(1, Math.min(720, input.votingDurationHours));
    }
    if (input.variantCost !== undefined) {
      $set.variantCost = Math.max(0, Math.min(1000, input.variantCost));
    }
    if (input.allowDownvotes !== undefined) {
      $set.allowDownvotes = input.allowDownvotes;
    }

    if (Object.keys($set).length <= 1) {
      return doc;
    }

    const result = await this.documentModel.updateOne(
      { id: documentId, deleted: false },
      { $set },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Document not found');
    }

    const updated = await this.getById(documentId);
    if (!updated) {
      throw new NotFoundException('Document not found');
    }
    return updated;
  }

  /** Replace full `sections` tree (structure edits §7.4). */
  async updateSections(
    documentId: string,
    sections: unknown[],
    options?: { expectedUpdatedAt?: Date },
  ): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'conflict' }> {
    const filter: Record<string, unknown> = { id: documentId, deleted: false };
    if (options?.expectedUpdatedAt) {
      filter.updatedAt = options.expectedUpdatedAt;
    }
    const result = await this.documentModel.updateOne(filter, {
      $set: { sections, updatedAt: new Date() },
    });
    if (result.matchedCount > 0) {
      return { ok: true };
    }
    const exists = await this.documentModel.exists({ id: documentId, deleted: false });
    return { ok: false, reason: exists ? 'conflict' : 'not_found' };
  }

  /**
   * Mutate one embedded block (sections[].blocks[]) and persist.
   */
  async updateDocumentBlock(
    documentId: string,
    blockId: string,
    mutate: (block: Record<string, unknown>) => void,
  ): Promise<boolean> {
    const mdoc = await this.documentModel.findOne({ id: documentId, deleted: false });
    if (!mdoc) {
      return false;
    }
    const sections = mdoc.sections as Array<{
      blocks?: Array<Record<string, unknown>>;
    }>;
    for (const sec of sections ?? []) {
      for (const b of sec.blocks ?? []) {
        if (b.id === blockId) {
          mutate(b);
          mdoc.markModified('sections');
          mdoc.set('updatedAt', new Date());
          await mdoc.save();
          return true;
        }
      }
    }
    return false;
  }

  /** Sync plain text mirror for ОБ / описание проекта (§5.3). */
  async mirrorOfficialTextToCommunityIfApplicable(documentId: string): Promise<void> {
    const doc = await this.getById(documentId);
    if (!doc || doc.deleted) {
      return;
    }
    if (doc.type !== 'imageOfFuture' && doc.type !== 'description') {
      return;
    }
    const plain = this.concatOfficialPlainText(
      (doc.sections as SectionLike[]).map((sec) => ({
        order: sec.order,
        title: sec.title,
        blocks: (sec.blocks as BlockLike[]).map((b) => ({
          order: b.order,
          officialContent: b.officialContent,
        })),
      })),
    );
    const field = doc.type === 'imageOfFuture' ? 'futureVisionText' : 'description';
    await this.communityModel.updateOne(
      { id: doc.communityId },
      { $set: { [field]: plain, updatedAt: new Date() } },
    );

    if (field === 'futureVisionText') {
      const futureVisionHub = await this.communityModel
        .findOne({ typeTag: 'future-vision' })
        .lean()
        .exec();
      if (futureVisionHub?.id) {
        try {
          const updated = await this.publicationService.updateFutureVisionPostContent(
            futureVisionHub.id,
            doc.communityId,
            plain,
          );
          if (!updated) {
            const authorId = await this.resolveFutureVisionPostAuthorId(
              doc.communityId,
              doc.createdBy,
            );
            if (authorId) {
              await this.publicationService.createFutureVisionPost({
                futureVisionCommunityId: futureVisionHub.id,
                authorId,
                content: plain,
                sourceEntityId: doc.communityId,
              });
            }
          }
        } catch (err) {
          this.logger.warn(
            `Failed to sync OB publication for community ${doc.communityId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }
  }

  private async resolveFutureVisionPostAuthorId(
    communityId: string,
    docCreatedBy?: string,
  ): Promise<string | null> {
    if (docCreatedBy) {
      return docCreatedBy;
    }
    const community = await this.communityModel
      .findOne({ id: communityId })
      .select({ createdByUserId: 1, founderUserId: 1 })
      .lean()
      .exec();
    if (community?.createdByUserId) {
      return community.createdByUserId;
    }
    if (community?.founderUserId) {
      return community.founderUserId;
    }
    return null;
  }
}
