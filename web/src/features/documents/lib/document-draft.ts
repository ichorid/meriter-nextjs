import type { MeriterBlockType } from '@/features/documents/types/document-block';
import type { DocBlock, DocSection } from '@/features/documents/lib/document-canvas-shared';
import { isEmptyTipTapHtml } from '@/features/documents/lib/document-canvas-shared';
import { joinDocumentBlocksToHtml } from '@/features/documents/lib/document-html-structure';
import { parseDocumentHtmlToBlocks } from '@/features/documents/lib/document-html-parse-blocks';

export interface DocumentDraft {
  sections: DocSection[];
}

export interface DocumentSeedBlock {
  order: number;
  blockType: MeriterBlockType;
  officialContent: string;
  proposalsLocked?: boolean;
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

/** Joined HTML for the unified draft editor (all sections/blocks). */
export function draftToEditorHtml(draft: DocumentDraft): string {
  return joinDocumentBlocksToHtml(draft.sections);
}

/** Keep a single editing buffer; blocks are derived on serialize via parseDocumentHtmlToBlocks. */
export function updateDraftFromEditorHtml(draft: DocumentDraft, html: string): DocumentDraft {
  const firstSection = draft.sections[0];
  const sectionId = firstSection?.id ?? crypto.randomUUID();
  const firstBlock = firstSection?.blocks?.[0];
  const blockId = firstBlock?.id ?? crypto.randomUUID();
  const content = html.trim() || '<p></p>';

  return {
    sections: [
      {
        id: sectionId,
        title: firstSection?.title ?? '',
        order: 0,
        blocks: [
          {
            id: blockId,
            order: 0,
            blockType: firstBlock?.blockType ?? 'paragraph',
            officialContent: content,
            officialContentReason: firstBlock?.officialContentReason ?? 'initial',
          },
        ],
      },
    ],
  };
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
  const html = draftToEditorHtml(draft);
  const parsed = parseDocumentHtmlToBlocks(html);
  const blocks =
    parsed.length > 0
      ? parsed
      : [{ blockType: 'paragraph' as const, officialContent: '<p></p>', order: 0 }];

  const sortedSections = [...draft.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const primaryTitle = sortedSections[0]?.title?.trim();

  return {
    sections: [
      {
        title: primaryTitle || undefined,
        order: 0,
        blocks: blocks.map((block, blockIndex) => ({
          order: blockIndex,
          blockType: block.blockType,
          officialContent: block.officialContent.trim() || '<p></p>',
        })),
      },
    ],
  };
}

export function blockHasOfficialContent(block: DocBlock): boolean {
  return !isEmptyTipTapHtml(block.officialContent ?? '');
}
