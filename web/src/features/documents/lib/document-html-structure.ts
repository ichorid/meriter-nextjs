import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { htmlToPlainText } from '@/features/documents/lib/document-text-diff';

export function joinDocumentBlocksToHtml(sections: unknown): string {
  const groups = groupBlocksBySection(sections);
  return groups
    .flatMap((g) => g.blocks)
    .map((b) => b.officialContent ?? '')
    .join('');
}

export function selectionRangeInBlock(
  blockRoot: HTMLElement,
  selection: Selection,
): { rangeStart: number; rangeEnd: number; excerpt: string } | null {
  if (!selection.rangeCount) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!blockRoot.contains(range.commonAncestorContainer)) {
    return null;
  }
  const preRange = document.createRange();
  preRange.selectNodeContents(blockRoot);
  preRange.setEnd(range.startContainer, range.startOffset);
  const rangeStart = preRange.toString().length;
  const excerpt = range.toString();
  const rangeEnd = rangeStart + excerpt.length;
  if (rangeEnd <= rangeStart) {
    return null;
  }
  return { rangeStart, rangeEnd, excerpt };
}

export function blockPlainTextLength(html: string): number {
  return htmlToPlainText(html).length;
}
