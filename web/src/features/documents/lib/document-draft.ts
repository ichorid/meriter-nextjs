import type { MeriterBlockType } from '@/features/documents/types/document-block';
import type { DocBlock, DocSection } from '@/features/documents/lib/document-canvas-shared';
import { isEmptyTipTapHtml } from '@/features/documents/lib/document-canvas-shared';

export interface DocumentDraft {
  sections: DocSection[];
}

export interface DocumentSeedBlock {
  order: number;
  blockType: MeriterBlockType;
  officialContent: string;
}

export interface DocumentSeedSection {
  title?: string;
  order: number;
  blocks: DocumentSeedBlock[];
}

export interface FutureVisionDocumentSeed {
  sections: DocumentSeedSection[];
}

function stripHtmlForMirror(raw: string): string {
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

/** Plain text for community `futureVisionText` / OB post (mirrors API `concatOfficialPlainText`). */
export function concatOfficialPlainTextFromDraft(draft: DocumentDraft): string {
  const sortedSections = [...draft.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const chunks: string[] = [];

  for (const sec of sortedSections) {
    const sortedBlocks = [...(sec.blocks ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const body = sortedBlocks
      .map((b) => stripHtmlForMirror(b.officialContent ?? ''))
      .filter(Boolean)
      .join('\n\n');

    if (sec.title?.trim()) {
      chunks.push(`\n\n# ${sec.title.trim()}\n\n${body}`);
    } else if (body) {
      chunks.push(body);
    }
  }

  return chunks.join('\n\n').trim();
}

export function documentDraftHasOfficialText(draft: DocumentDraft): boolean {
  return concatOfficialPlainTextFromDraft(draft).length > 0;
}

export function createEmptyDocumentDraft(): DocumentDraft {
  const sectionId = crypto.randomUUID();
  const blockId = crypto.randomUUID();
  return {
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
            officialContent: '<p></p>',
            officialContentReason: 'initial',
          },
        ],
      },
    ],
  };
}

export function serializeDraftForApi(draft: DocumentDraft): FutureVisionDocumentSeed {
  const sortedSections = [...draft.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return {
    sections: sortedSections.map((sec, sectionIndex) => {
      const blocks = [...(sec.blocks ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return {
        title: sec.title?.trim() || undefined,
        order: sectionIndex,
        blocks: blocks.map((block, blockIndex) => ({
          order: blockIndex,
          blockType: (block.blockType as MeriterBlockType) || 'paragraph',
          officialContent: block.officialContent?.trim() || '<p></p>',
        })),
      };
    }),
  };
}

export function blockHasOfficialContent(block: DocBlock): boolean {
  return !isEmptyTipTapHtml(block.officialContent ?? '');
}
