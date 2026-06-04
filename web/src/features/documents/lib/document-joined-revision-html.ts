import { mergeRangeIntoBlockHtmlWithRevisionMarks } from '@/features/documents/lib/document-block-merge';
import {
  parseDocumentHtmlToBlocks,
  type ParsedStructureBlock,
} from '@/features/documents/lib/document-html-parse-blocks';
import { joinBlocksToDisplayHtml } from '@/features/documents/lib/document-html-structure';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import { findPlainTextChangeBounds } from '@/features/documents/lib/document-variant-preview';
import { DOC_REVISION_INSERT_CLASS } from '@/features/documents/lib/document-revision-styles';
import { variantDiffersFromOfficial } from '@/features/documents/lib/document-text-diff';

function blockPlainKey(html: string): string {
  return blockHtmlToPlainText(html).replace(/\s+/g, ' ').trim();
}

type BlockAlignOp =
  | { op: 'equal'; official: ParsedStructureBlock; variant: ParsedStructureBlock }
  | { op: 'insert'; variant: ParsedStructureBlock }
  | { op: 'delete'; official: ParsedStructureBlock };

/** LCS alignment on block plain-text keys for joined revision markup. */
export function alignDocumentBlocksByPlain(
  official: ParsedStructureBlock[],
  variant: ParsedStructureBlock[],
): BlockAlignOp[] {
  const a = official.map((b) => blockPlainKey(b.officialContent));
  const b = variant.map((v) => blockPlainKey(v.officialContent));
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const ops: BlockAlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({
        op: 'equal',
        official: official[i - 1]!,
        variant: variant[j - 1]!,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.push({ op: 'insert', variant: variant[j - 1]! });
      j--;
    } else {
      ops.push({ op: 'delete', official: official[i - 1]! });
      i--;
    }
  }

  ops.reverse();
  return ops;
}

function wrapBlockAsInsert(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return '';
  }
  if (/class="/i.test(trimmed)) {
    return trimmed.replace(
      /class="([^"]*)"/i,
      `class="$1 ${DOC_REVISION_INSERT_CLASS}"`,
    );
  }
  return trimmed.replace(/^(<[a-z0-9]+)/i, `$1 class="${DOC_REVISION_INSERT_CLASS}"`);
}

function renderDeletedBlock(officialHtml: string): string {
  const plain = blockHtmlToPlainText(officialHtml);
  if (!plain.trim()) {
    return '';
  }
  return mergeRangeIntoBlockHtmlWithRevisionMarks(officialHtml, 0, plain.length, '');
}

function renderAlignedBlock(op: BlockAlignOp): string {
  if (op.op === 'insert') {
    return wrapBlockAsInsert(op.variant.officialContent);
  }
  if (op.op === 'delete') {
    return renderDeletedBlock(op.official.officialContent);
  }

  const officialHtml = op.official.officialContent;
  const variantHtml = op.variant.officialContent;
  if (blockPlainKey(officialHtml) === blockPlainKey(variantHtml)) {
    return variantHtml;
  }

  const bounds = findPlainTextChangeBounds(
    blockHtmlToPlainText(officialHtml),
    blockHtmlToPlainText(variantHtml),
  );
  if (!bounds) {
    return variantHtml;
  }
  return mergeRangeIntoBlockHtmlWithRevisionMarks(
    officialHtml,
    bounds.rangeStart,
    bounds.rangeEnd,
    bounds.proposedText,
  );
}

/**
 * Joined-document revision HTML for «Подсветить правки»: new blocks wrapped in <ins>, inline marks on edits.
 */
export function buildJoinedDocumentRevisionHtml(
  officialHtml: string,
  variantHtml: string,
): string | null {
  if (!variantDiffersFromOfficial(officialHtml, variantHtml)) {
    return null;
  }

  const officialBlocks = parseDocumentHtmlToBlocks(officialHtml);
  const variantBlocks = parseDocumentHtmlToBlocks(variantHtml);
  if (variantBlocks.length === 0) {
    return null;
  }

  const ops = alignDocumentBlocksByPlain(officialBlocks, variantBlocks);
  const joinable = ops.flatMap((op) => {
    const html = renderAlignedBlock(op);
    if (!html) {
      return [];
    }
    const blockType =
      op.op === 'delete' ? op.official.blockType : op.variant.blockType;
    return [{ blockType, officialContent: html }];
  });
  if (joinable.length === 0) {
    return null;
  }
  return joinBlocksToDisplayHtml(joinable);
}
