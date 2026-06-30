import { blockHtmlToPlainText, headPlainSnippet, tailPlainSnippet } from '@/features/documents/lib/document-plain-text';

export const VARIANT_PREVIEW_CONTEXT_CHARS = 72;

export type VariantChangeBounds = {
  rangeStart: number;
  rangeEnd: number;
  proposedText: string;
};

export type VariantPreviewSegment =
  | { kind: 'context'; text: string; position: 'before' | 'after' | 'prevBlock' | 'nextBlock' }
  | { kind: 'delete'; text: string }
  | { kind: 'insert'; html: string };

export type VariantDisplayPreview = {
  segments: VariantPreviewSegment[];
  canCompare: boolean;
};

export type VariantPreviewInput = {
  content: string;
  proposalScope?: 'block' | 'patches';
  patches?: Array<{
    blockId: string;
    rangeStart: number;
    rangeEnd: number;
    proposedText: string;
    previewContent: string;
    insertAfterBlockId?: string;
    insertBlocks?: Array<{ blockType: string; officialContent: string }>;
  }>;
  rangeStart?: number;
  rangeEnd?: number;
  proposedText?: string;
};

export function findPlainTextChangeBounds(
  officialPlain: string,
  variantPlain: string,
): VariantChangeBounds | null {
  if (officialPlain === variantPlain) {
    return null;
  }

  let prefix = 0;
  const minLen = Math.min(officialPlain.length, variantPlain.length);
  while (prefix < minLen && officialPlain[prefix] === variantPlain[prefix]) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < officialPlain.length - prefix &&
    suffix < variantPlain.length - prefix &&
    officialPlain[officialPlain.length - 1 - suffix] ===
      variantPlain[variantPlain.length - 1 - suffix]
  ) {
    suffix++;
  }

  const rangeStart = prefix;
  const rangeEnd = officialPlain.length - suffix;
  const proposedText = variantPlain.slice(prefix, variantPlain.length - suffix);
  if (!proposedText && rangeEnd <= rangeStart) {
    return null;
  }
  return { rangeStart, rangeEnd, proposedText };
}

export function resolveVariantChangeBounds(
  officialHtml: string,
  variant: VariantPreviewInput,
): VariantChangeBounds | null {
  const hasStoredRange =
    typeof variant.rangeStart === 'number' &&
    typeof variant.rangeEnd === 'number' &&
    variant.proposedText != null &&
    variant.rangeEnd >= variant.rangeStart;

  if (hasStoredRange) {
    const hasMeaningfulRange =
      variant.rangeEnd! > variant.rangeStart! || (variant.proposedText?.trim() ?? '').length > 0;
    if (hasMeaningfulRange) {
      return {
        rangeStart: variant.rangeStart!,
        rangeEnd: variant.rangeEnd!,
        proposedText: variant.proposedText!,
      };
    }
  }

  const officialPlain = blockHtmlToPlainText(officialHtml);
  const variantPlain = blockHtmlToPlainText(variant.content);
  return findPlainTextChangeBounds(officialPlain, variantPlain);
}

function plainInsertToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildVariantDisplayPreview(
  officialHtml: string,
  variant: VariantPreviewInput,
  options?: {
    contextChars?: number;
    prevBlockHtml?: string;
    nextBlockHtml?: string;
  },
): VariantDisplayPreview | null {
  const bounds = resolveVariantChangeBounds(officialHtml, variant);
  if (!bounds) {
    return null;
  }

  const contextChars = options?.contextChars ?? VARIANT_PREVIEW_CONTEXT_CHARS;
  const officialPlain = blockHtmlToPlainText(officialHtml);
  const { rangeStart, rangeEnd, proposedText } = bounds;

  const segments: VariantPreviewSegment[] = [];

  if (rangeStart === 0 && options?.prevBlockHtml?.trim()) {
    const prevPlain = blockHtmlToPlainText(options.prevBlockHtml);
    if (prevPlain) {
      segments.push({
        kind: 'context',
        position: 'prevBlock',
        text: tailPlainSnippet(prevPlain, contextChars),
      });
    }
  } else {
    const before = officialPlain.slice(0, rangeStart);
    if (before.trim()) {
      segments.push({
        kind: 'context',
        position: 'before',
        text: tailPlainSnippet(before, contextChars),
      });
    }
  }

  const deleted = officialPlain.slice(rangeStart, rangeEnd);
  if (deleted.trim()) {
    segments.push({ kind: 'delete', text: deleted });
  }

  const insertHtml =
    variant.proposedText != null && variant.rangeStart != null
      ? variant.proposedText
      : plainInsertToHtml(proposedText);
  if (insertHtml.trim() || proposedText.trim()) {
    segments.push({ kind: 'insert', html: insertHtml || plainInsertToHtml(proposedText) });
  }

  if (rangeEnd >= officialPlain.length && options?.nextBlockHtml?.trim()) {
    const nextPlain = blockHtmlToPlainText(options.nextBlockHtml);
    if (nextPlain) {
      segments.push({
        kind: 'context',
        position: 'nextBlock',
        text: headPlainSnippet(nextPlain, contextChars),
      });
    }
  } else {
    const after = officialPlain.slice(rangeEnd);
    if (after.trim()) {
      segments.push({
        kind: 'context',
        position: 'after',
        text: headPlainSnippet(after, contextChars),
      });
    }
  }

  if (segments.length === 0) {
    return null;
  }

  const variantPlain = blockHtmlToPlainText(variant.content);
  const canCompare =
    officialPlain.length > 0 && officialPlain !== variantPlain && variant.content.trim().length > 0;

  return { segments, canCompare };
}
