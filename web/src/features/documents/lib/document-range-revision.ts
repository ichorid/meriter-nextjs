import { expandDeletionRangeStart } from '@/features/documents/lib/document-plain-range';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import type { RevisionToken, StructuredRevision } from '@/features/documents/lib/document-text-diff';

/** Character-level revision on joined document plain text (Google Docs style). */
export function buildPlainTextRangeRevision(
  joinedPlain: string,
  globalStart: number,
  globalEnd: number,
  proposedText: string,
): StructuredRevision | null {
  const plain = joinedPlain;
  let start = Math.max(0, Math.min(plain.length, Math.floor(globalStart)));
  const end = Math.max(start, Math.min(plain.length, Math.floor(globalEnd)));
  const insertText = proposedText ?? '';
  if (end > start && !insertText.trim()) {
    start = expandDeletionRangeStart(plain, start);
  }

  const before = plain.slice(0, start);
  const deleted = plain.slice(start, end);
  const after = plain.slice(end);

  const tokens: RevisionToken[] = [];
  if (before) {
    tokens.push({ kind: 'same', value: before });
  }
  if (deleted) {
    tokens.push({ kind: 'delete', value: deleted });
  }
  if (insertText) {
    tokens.push({ kind: 'insert', value: insertText });
  }
  if (after) {
    tokens.push({ kind: 'same', value: after });
  }

  if (tokens.every((t) => t.kind === 'same')) {
    return null;
  }
  return { kind: 'flat', tokens };
}

export function buildHtmlRangeRevision(
  joinedPlain: string,
  globalStart: number,
  globalEnd: number,
  proposedHtml: string,
): StructuredRevision | null {
  const insertPlain = blockHtmlToPlainText(proposedHtml);
  return buildPlainTextRangeRevision(joinedPlain, globalStart, globalEnd, insertPlain);
}
