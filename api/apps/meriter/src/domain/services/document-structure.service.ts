import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  MeriterDocumentSchemaClass,
} from '../models/meriter-document/meriter-document.schema';
import {
  DOCUMENT_PERSISTENCE_PORT,
  type DocumentPersistencePort,
} from '../ports/document.persistence.port';
import { splitSectionBlockForLockedRanges } from '../common/document-block-structure.util';
import { DocumentLiveUpdatesService } from './document-live-updates.service';
import { DocumentService } from './document.service';
import { DocumentVariantService } from './document-variant.service';

export type MeriterBlockType =
  | 'paragraph'
  | 'heading'
  | 'list-bullet'
  | 'list-numbered'
  | 'quote';

interface SectionEmbedded {
  id: string;
  title?: string;
  order: number;
  blocks: BlockEmbedded[];
}

interface BlockEmbedded {
  id: string;
  order: number;
  blockType: MeriterBlockType;
  officialContent?: string;
  officialContentSetAt?: Date;
  officialContentSetBy?: string;
  officialContentReason?: string;
  officialContentVariantId?: string;
  currentWaveStartedAt?: Date;
  editHistory?: unknown[];
  proposalsLocked?: boolean;
  lockedRanges?: Array<{ rangeStart: number; rangeEnd: number }>;
}

type StructureWriteInput = {
  expectedUpdatedAt?: Date;
};

@Injectable()
export class DocumentStructureService {
  constructor(
    private readonly documentService: DocumentService,
    private readonly documentVariantService: DocumentVariantService,
    private readonly documentLiveUpdates: DocumentLiveUpdatesService,
    @Inject(DOCUMENT_PERSISTENCE_PORT)
    private readonly documentPersistence: DocumentPersistencePort,
  ) {}

  async addSection(
    actorUserId: string,
    documentId: string,
    input: { title?: string; order?: number } & StructureWriteInput,
  ): Promise<MeriterDocumentSchemaClass> {
    const doc = await this.requireManageableDocument(actorUserId, documentId);
    const sections = this.cloneSections(doc);
    const order =
      input.order ??
      (sections.length > 0 ? Math.max(...sections.map((s) => s.order)) + 1 : 0);
    sections.push({
      id: randomUUID(),
      title: input.title?.trim() ?? '',
      order,
      blocks: [],
    });
    return this.persistSections(documentId, sections, doc, input.expectedUpdatedAt);
  }

  async updateSection(
    actorUserId: string,
    documentId: string,
    sectionId: string,
    input: { title?: string; order?: number } & StructureWriteInput,
  ): Promise<MeriterDocumentSchemaClass> {
    const doc = await this.requireManageableDocument(actorUserId, documentId);
    const sections = this.cloneSections(doc);
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) {
      throw new NotFoundException('Section not found');
    }
    if (input.title !== undefined) {
      sec.title = input.title.trim();
    }
    if (input.order !== undefined) {
      sec.order = input.order;
    }
    return this.persistSections(documentId, sections, doc, input.expectedUpdatedAt);
  }

  async removeSection(
    actorUserId: string,
    documentId: string,
    sectionId: string,
    input: { confirmLossOfOfficial?: boolean } & StructureWriteInput,
  ): Promise<MeriterDocumentSchemaClass> {
    const doc = await this.requireManageableDocument(actorUserId, documentId);
    const sections = this.cloneSections(doc);
    if (sections.length <= 1) {
      throw new BadRequestException('Cannot remove the only section');
    }
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) {
      throw new NotFoundException('Section not found');
    }
    this.assertConfirmIfOfficialBlocks(sec.blocks, input.confirmLossOfOfficial);
    for (const b of sec.blocks) {
      await this.withdrawOpenVariantsOnBlock(documentId, b.id);
    }
    const next = sections.filter((s) => s.id !== sectionId);
    return this.persistSections(documentId, next, doc, input.expectedUpdatedAt);
  }

  async addBlock(
    actorUserId: string,
    documentId: string,
    sectionId: string,
    input: { blockType: MeriterBlockType; order?: number } & StructureWriteInput,
  ): Promise<MeriterDocumentSchemaClass> {
    const doc = await this.requireManageableDocument(actorUserId, documentId);
    const sections = this.cloneSections(doc);
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) {
      throw new NotFoundException('Section not found');
    }
    const order =
      input.order ??
      (sec.blocks.length > 0 ? Math.max(...sec.blocks.map((b) => b.order)) + 1 : 0);
    sec.blocks.push({
      id: randomUUID(),
      order,
      blockType: input.blockType,
      officialContent: '',
      editHistory: [],
    });
    return this.persistSections(documentId, sections, doc, input.expectedUpdatedAt);
  }

  async updateBlock(
    actorUserId: string,
    documentId: string,
    blockId: string,
    input: {
      blockType?: MeriterBlockType;
      order?: number;
      proposalsLocked?: boolean;
      lockedRanges?: Array<{ rangeStart: number; rangeEnd: number }>;
    } & StructureWriteInput,
  ): Promise<MeriterDocumentSchemaClass> {
    const doc = await this.requireManageableDocument(actorUserId, documentId);
    const sections = this.cloneSections(doc);
    const located = this.findBlockInSections(sections, blockId);
    if (!located) {
      throw new NotFoundException('Block not found');
    }
    if (input.blockType !== undefined) {
      located.block.blockType = input.blockType;
    }
    if (input.order !== undefined) {
      located.block.order = input.order;
    }
    if (input.proposalsLocked !== undefined) {
      located.block.proposalsLocked = input.proposalsLocked;
    }
    const locksChanged = input.lockedRanges !== undefined;
    if (locksChanged) {
      located.block.lockedRanges = input.lockedRanges;
      const splitRows = splitSectionBlockForLockedRanges(
        located.section.blocks as Parameters<typeof splitSectionBlockForLockedRanges>[0],
        blockId,
      );
      if (splitRows.length !== located.section.blocks.length) {
        located.section.blocks = splitRows as BlockEmbedded[];
      }
    }
    const updated = await this.persistSections(documentId, sections, doc, input.expectedUpdatedAt);
    if (locksChanged || input.proposalsLocked !== undefined) {
      this.documentLiveUpdates.publish({
        type: 'block.locks_changed',
        documentId,
        documentUpdatedAt: updated.updatedAt,
        blockId,
        actorUserId,
      });
    }
    return updated;
  }

  async reorderBlocks(
    actorUserId: string,
    documentId: string,
    sectionId: string,
    input: { blockIds: string[] } & StructureWriteInput,
  ): Promise<MeriterDocumentSchemaClass> {
    const doc = await this.requireManageableDocument(actorUserId, documentId);
    const sections = this.cloneSections(doc);
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) {
      throw new NotFoundException('Section not found');
    }
    const existingIds = sec.blocks.map((b) => b.id).sort();
    const inputIds = [...input.blockIds].sort();
    if (
      existingIds.length !== inputIds.length ||
      !existingIds.every((id, index) => id === inputIds[index])
    ) {
      throw new BadRequestException('blockIds must match section blocks exactly');
    }
    const byId = new Map(sec.blocks.map((b) => [b.id, b]));
    sec.blocks = input.blockIds.map((id, order) => {
      const block = byId.get(id);
      if (!block) {
        throw new NotFoundException('Block not found');
      }
      return { ...block, order };
    });
    return this.persistSections(documentId, sections, doc, input.expectedUpdatedAt);
  }

  async removeBlock(
    actorUserId: string,
    documentId: string,
    blockId: string,
    input: { confirmLossOfOfficial: boolean } & StructureWriteInput,
  ): Promise<MeriterDocumentSchemaClass> {
    const doc = await this.requireManageableDocument(actorUserId, documentId);
    const sections = this.cloneSections(doc);
    const totalBlocks = sections.reduce((n, s) => n + s.blocks.length, 0);
    if (totalBlocks <= 1) {
      throw new BadRequestException('Cannot remove the only block');
    }
    const located = this.findBlockInSections(sections, blockId);
    if (!located) {
      throw new NotFoundException('Block not found');
    }
    this.assertConfirmIfOfficialBlocks([located.block], input.confirmLossOfOfficial);
    await this.withdrawOpenVariantsOnBlock(documentId, blockId);
    located.section.blocks = located.section.blocks.filter((b) => b.id !== blockId);
    if (located.section.blocks.length === 0 && sections.length > 1) {
      const next = sections.filter((s) => s.id !== located.section.id);
      return this.persistSections(documentId, next, doc, input.expectedUpdatedAt);
    }
    return this.persistSections(documentId, sections, doc, input.expectedUpdatedAt);
  }

  private async requireManageableDocument(
    actorUserId: string,
    documentId: string,
  ): Promise<MeriterDocumentSchemaClass> {
    const doc = await this.documentService.getById(documentId);
    if (!doc || doc.deleted || doc.status !== 'active') {
      throw new NotFoundException('Document not found');
    }
    await this.documentVariantService.assertCanEditDocumentStructure(actorUserId, doc);
    return doc;
  }

  private cloneSections(doc: MeriterDocumentSchemaClass): SectionEmbedded[] {
    const raw = doc.sections as SectionEmbedded[] | undefined;
    return (raw ?? []).map((sec) => ({
      id: sec.id,
      title: sec.title ?? '',
      order: sec.order ?? 0,
      blocks: (sec.blocks ?? []).map((b) => ({
        id: b.id,
        order: b.order ?? 0,
        blockType: (b.blockType ?? 'paragraph') as MeriterBlockType,
        officialContent: b.officialContent ?? '',
        officialContentSetAt: b.officialContentSetAt,
        officialContentSetBy: b.officialContentSetBy,
        officialContentReason: b.officialContentReason,
        officialContentVariantId: b.officialContentVariantId,
        currentWaveStartedAt: b.currentWaveStartedAt,
        editHistory: Array.isArray(b.editHistory) ? [...b.editHistory] : [],
        proposalsLocked: b.proposalsLocked === true,
      })),
    }));
  }

  private findBlockInSections(
    sections: SectionEmbedded[],
    blockId: string,
  ): { section: SectionEmbedded; block: BlockEmbedded } | null {
    for (const sec of sections) {
      const block = sec.blocks.find((b) => b.id === blockId);
      if (block) {
        return { section: sec, block };
      }
    }
    return null;
  }

  private assertConfirmIfOfficialBlocks(
    blocks: BlockEmbedded[],
    confirmLossOfOfficial: boolean | undefined,
  ): void {
    const hasOfficial = blocks.some((b) => (b.officialContent ?? '').trim().length > 0);
    if (hasOfficial && !confirmLossOfOfficial) {
      throw new BadRequestException(
        'This block contains official text; confirmLossOfOfficial is required',
      );
    }
  }

  private async withdrawOpenVariantsOnBlock(
    documentId: string,
    blockId: string,
  ): Promise<void> {
    await this.documentPersistence.withdrawOpenVariantsOnBlock(documentId, blockId);
  }

  private async persistSections(
    documentId: string,
    sections: SectionEmbedded[],
    previous: MeriterDocumentSchemaClass,
    expectedUpdatedAt?: Date,
  ): Promise<MeriterDocumentSchemaClass> {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    for (const sec of sorted) {
      sec.blocks.sort((a, b) => a.order - b.order);
    }
    const result = await this.documentService.updateSections(documentId, sorted, {
      expectedUpdatedAt: expectedUpdatedAt ?? previous.updatedAt,
    });
    if (!result.ok) {
      if (result.reason === 'conflict') {
        throw new ConflictException(
          'Document was modified elsewhere; refresh the page and try again',
        );
      }
      throw new BadRequestException('Failed to update document structure');
    }
    if (
      previous.type === 'imageOfFuture' ||
      previous.type === 'description'
    ) {
      await this.documentService.mirrorOfficialTextToCommunityIfApplicable(documentId);
    }
    const doc = await this.documentService.getById(documentId);
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }
}
