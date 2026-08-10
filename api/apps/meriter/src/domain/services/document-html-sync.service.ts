import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  mapStableBlockIds,
  parseDocumentHtmlToBlocks,
  type BlockMappingReport,
} from '../common/document-html-structure.util';
import { blockHtmlToPlainText } from '../common/document-plain-text.util';
import {
  resolveVariantRangeBounds,
} from '../common/document-range.util';
import { sanitizeDocumentHtml } from '../../common/utils/sanitize-document-html';
import type { MeriterDocumentSchemaClass } from '../models/meriter-document/meriter-document.schema';
import {
  DOCUMENT_PERSISTENCE_PORT,
  type DocumentPersistencePort,
} from '../ports/document.persistence.port';
import { DocumentLiveUpdatesService } from './document-live-updates.service';
import { DocumentService } from './document.service';
import { DocumentVariantService } from './document-variant.service';

export type SyncStructureFromHtmlResult = {
  document: MeriterDocumentSchemaClass;
  mapping: BlockMappingReport;
};

@Injectable()
export class DocumentHtmlSyncService {
  constructor(
    private readonly documentService: DocumentService,
    private readonly documentVariantService: DocumentVariantService,
    private readonly documentLiveUpdates: DocumentLiveUpdatesService,
    @Inject(DOCUMENT_PERSISTENCE_PORT)
    private readonly documentPersistence: DocumentPersistencePort,
  ) {}

  async syncStructureFromHtml(
    actorUserId: string,
    input: {
      documentId: string;
      html: string;
      expectedUpdatedAt?: Date;
    },
  ): Promise<SyncStructureFromHtmlResult> {
    const doc = await this.documentService.getById(input.documentId);
    if (!doc || doc.deleted || doc.status !== 'active') {
      throw new NotFoundException('Document not found');
    }
    await this.documentVariantService.assertCanEditDocumentStructure(actorUserId, doc);

    const html = sanitizeDocumentHtml(input.html ?? '');
    const parsed = parseDocumentHtmlToBlocks(html);

    const existingSections = (doc.sections ?? []) as Array<{
      id: string;
      title?: string;
      order: number;
      blocks: Array<{
        id: string;
        order: number;
        blockType: string;
        officialContent?: string;
        proposalsLocked?: boolean;
        lockedRanges?: Array<{ rangeStart: number; rangeEnd: number }>;
        currentWaveStartedAt?: Date;
        officialRating?: number;
        editHistory?: unknown[];
        officialContentSetAt?: Date;
        officialContentSetBy?: string;
        officialContentReason?: string;
        officialContentVariantId?: string;
      }>;
    }>;

    const sectionId = existingSections[0]?.id ?? randomUUID();
    const existingBlocks =
      existingSections[0]?.blocks?.map((b) => ({
        id: b.id,
        order: b.order ?? 0,
        blockType: b.blockType as
          | 'paragraph'
          | 'heading'
          | 'list-bullet'
          | 'list-numbered'
          | 'quote',
        officialContent: b.officialContent,
        proposalsLocked: b.proposalsLocked,
        lockedRanges: b.lockedRanges,
        currentWaveStartedAt: b.currentWaveStartedAt,
        officialRating: b.officialRating,
        editHistory: b.editHistory,
        officialContentSetAt: b.officialContentSetAt,
        officialContentSetBy: b.officialContentSetBy,
        officialContentReason: b.officialContentReason,
        officialContentVariantId: b.officialContentVariantId,
      })) ?? [];

    const { blocks: mappedBlocks, report } = mapStableBlockIds(existingBlocks, parsed);

    const sections = [
      {
        id: sectionId,
        title: '',
        order: 0,
        blocks: mappedBlocks.map((b) => ({
          id: b.id,
          order: b.order,
          blockType: b.blockType,
          officialContent: b.officialContent,
          proposalsLocked: b.proposalsLocked ?? false,
          lockedRanges: b.lockedRanges ?? [],
          currentWaveStartedAt: b.currentWaveStartedAt,
          officialRating: b.officialRating ?? 0,
          editHistory: b.editHistory ?? [],
          officialContentSetAt: b.officialContentSetAt,
          officialContentSetBy: b.officialContentSetBy,
          officialContentReason: b.officialContentReason,
          officialContentVariantId: b.officialContentVariantId,
        })),
      },
    ];

    const structureUnchanged =
      report.created.length === 0 &&
      report.removed.length === 0 &&
      mappedBlocks.length === existingBlocks.length &&
      mappedBlocks.every((b) => {
        const ex = existingBlocks.find((e) => e.id === b.id);
        return (
          ex &&
          (ex.officialContent ?? '') === (b.officialContent ?? '') &&
          ex.blockType === b.blockType &&
          (ex.order ?? 0) === b.order
        );
      }) &&
      existingSections.length === 1 &&
      existingSections[0]?.id === sectionId;

    if (structureUnchanged) {
      return { document: doc, mapping: report };
    }

    if (report.removed.length > 0) {
      for (const blockId of report.removed) {
        await this.documentPersistence.withdrawOpenVariantsOnBlock(doc.id, blockId);
      }
    }

    const blockById = new Map(mappedBlocks.map((b) => [b.id, b]));
    const openVariants = await this.documentPersistence.findOpenVariantsByBlockIds(
      doc.id,
      [...blockById.keys()],
    );

    for (const variant of openVariants) {
      const block = blockById.get(variant.blockId);
      if (!block) {
        continue;
      }
      const officialHtml = block.officialContent ?? '';
      const plainLen = blockHtmlToPlainText(officialHtml).length;
      const bounds = resolveVariantRangeBounds(variant, officialHtml);
      if (bounds.rangeEnd > plainLen || bounds.rangeStart >= plainLen) {
        await this.documentPersistence.updateVariantStatus(variant.id, 'withdrawn');
      }
    }

    const result = await this.documentService.updateSections(doc.id, sections, {
      expectedUpdatedAt: input.expectedUpdatedAt ?? doc.updatedAt,
    });
    if (!result.ok) {
      if (result.reason === 'conflict') {
        throw new ConflictException(
          'Document was modified elsewhere; refresh the page and try again',
        );
      }
      throw new BadRequestException('Failed to sync document structure');
    }

    if (doc.type === 'imageOfFuture' || doc.type === 'description') {
      await this.documentService.mirrorOfficialTextToCommunityIfApplicable(doc.id);
    }

    const updated = await this.documentService.getById(doc.id);
    if (!updated) {
      throw new NotFoundException('Document not found');
    }

    this.documentLiveUpdates.publish({
      type: 'document.updated',
      documentId: updated.id,
      documentUpdatedAt: updated.updatedAt,
      actorUserId,
    });

    return { document: updated, mapping: report };
  }
}
