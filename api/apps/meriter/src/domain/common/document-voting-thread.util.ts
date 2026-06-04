import { buildBlockPlainSegments, type BlockPlainSegment } from './document-block-structure.util';
import {
  patchToGlobalPlainRanges,
  type DocumentVariantPatch,
} from './document-proposal-patches.util';
import {
  resolveVariantRangeBounds,
  type DocumentRangeBounds,
} from './document-range.util';
import { rangesOverlap } from './document-plain-text.util';
import type { DocumentBlockVariantRecord } from '../ports/document.persistence.port';
import type { MeriterDocumentSchemaClass } from '../models/meriter-document/meriter-document.schema';

export type GlobalPlainRange = { rangeStart: number; rangeEnd: number };

export function globalRangesOverlap(
  a: GlobalPlainRange[],
  b: GlobalPlainRange[],
): boolean {
  for (const left of a) {
    for (const right of b) {
      if (
        rangesOverlap(
          left.rangeStart,
          left.rangeEnd,
          right.rangeStart,
          right.rangeEnd,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

export function mergeGlobalRanges(
  existing: GlobalPlainRange[],
  added: GlobalPlainRange[],
): GlobalPlainRange[] {
  return [...existing, ...added];
}

export function proposalGlobalRanges(
  segments: BlockPlainSegment[],
  patches: DocumentVariantPatch[],
): GlobalPlainRange[] {
  return patchToGlobalPlainRanges(segments, patches).map((r) => ({
    rangeStart: r.rangeStart,
    rangeEnd: r.rangeEnd,
  }));
}

export function variantGlobalRanges(
  segments: BlockPlainSegment[],
  variant: DocumentBlockVariantRecord,
  officialHtmlForBlock: (blockId: string) => string,
): GlobalPlainRange[] {
  if (variant.patches && variant.patches.length > 0) {
    return proposalGlobalRanges(segments, variant.patches as DocumentVariantPatch[]);
  }
  const officialHtml = officialHtmlForBlock(variant.blockId);
  const seg = segments.find((s) => s.blockId === variant.blockId);
  if (!seg) {
    return [];
  }
  const bounds: DocumentRangeBounds = resolveVariantRangeBounds(
    {
      rangeStart: variant.rangeStart,
      rangeEnd: variant.rangeEnd,
      content: variant.content,
    },
    officialHtml,
  );
  return [
    {
      rangeStart: seg.plainStart + bounds.rangeStart,
      rangeEnd: seg.plainStart + bounds.rangeEnd,
    },
  ];
}

export function buildSegmentsFromDocument(
  doc: MeriterDocumentSchemaClass,
): BlockPlainSegment[] {
  const rows: Array<{ id: string; officialContent: string }> = [];
  const sections = [...(doc.sections ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  for (const sec of sections) {
    for (const b of [...(sec.blocks ?? [])].sort((a, c) => a.order - c.order)) {
      rows.push({ id: b.id, officialContent: b.officialContent ?? '' });
    }
  }
  return buildBlockPlainSegments(rows).segments;
}
