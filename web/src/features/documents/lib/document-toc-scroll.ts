import { buildBlockPlainSegments } from '@/features/documents/lib/document-block-plain-segments';

const BLOCK_ANCHOR_PREFIX = 'block-';
const MAIN_SCROLL_SELECTOR = '.mainWrap';
const GDOCS_PROSE_SELECTOR = '.gdocs-editor-surface .ProseMirror';

function blockIdFromAnchorId(anchorId: string): string | null {
  if (!anchorId.startsWith(BLOCK_ANCHOR_PREFIX)) {
    return null;
  }
  return anchorId.slice(BLOCK_ANCHOR_PREFIX.length) || null;
}

function rangeAtPlainOffset(root: HTMLElement, offset: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let lastText: Text | null = null;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    lastText = node;
    const len = node.data.length;
    if (pos + len >= offset) {
      const range = document.createRange();
      const localOffset = Math.min(Math.max(0, offset - pos), len);
      range.setStart(node, localOffset);
      range.collapse(true);
      return range;
    }
    pos += len;
  }

  if (lastText && offset >= pos) {
    const range = document.createRange();
    range.setStart(lastText, lastText.data.length);
    range.collapse(true);
    return range;
  }

  return null;
}

function scrollMainWrapToRange(range: Range, stickyOffsetPx = 80): boolean {
  const mainWrap = document.querySelector(MAIN_SCROLL_SELECTOR) as HTMLElement | null;
  if (!mainWrap) {
    return false;
  }

  const targetRect = range.getBoundingClientRect();
  const wrapRect = mainWrap.getBoundingClientRect();
  const nextTop = mainWrap.scrollTop + (targetRect.top - wrapRect.top) - stickyOffsetPx;
  mainWrap.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  return true;
}

/**
 * Scroll the document view to a block anchor (`block-{id}`).
 * Supports unified Gdocs editor (ProseMirror plain offset) and per-block canvas anchors.
 */
export function scrollToDocumentBlockAnchor(
  anchorId: string,
  sections: unknown,
): boolean {
  const blockId = blockIdFromAnchorId(anchorId);
  if (!blockId) {
    return false;
  }

  const blockElement = document.getElementById(anchorId);
  if (blockElement) {
    const mainWrap = document.querySelector(MAIN_SCROLL_SELECTOR) as HTMLElement | null;
    if (mainWrap) {
      const targetRect = blockElement.getBoundingClientRect();
      const wrapRect = mainWrap.getBoundingClientRect();
      const nextTop = mainWrap.scrollTop + (targetRect.top - wrapRect.top) - 80;
      mainWrap.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
      return true;
    }
    blockElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  const prose = document.querySelector(GDOCS_PROSE_SELECTOR) as HTMLElement | null;
  if (!prose) {
    return false;
  }

  const { segments } = buildBlockPlainSegments(sections);
  const segment = segments.find((s) => s.blockId === blockId);
  if (!segment) {
    return false;
  }

  const range = rangeAtPlainOffset(prose, segment.plainStart);
  if (!range) {
    return false;
  }

  return scrollMainWrapToRange(range);
}

/** Pick the TOC entry whose block start is last above the viewport probe line. */
export function resolveActiveDocumentTocAnchor(
  entries: Array<{ anchorId: string }>,
  sections: unknown,
  probeTop: number,
): string | null {
  const prose = document.querySelector(GDOCS_PROSE_SELECTOR) as HTMLElement | null;
  if (!prose) {
    return null;
  }

  const { segments } = buildBlockPlainSegments(sections);
  let active: string | null = null;

  for (const entry of entries) {
    const blockId = blockIdFromAnchorId(entry.anchorId);
    if (!blockId) {
      continue;
    }
    const segment = segments.find((s) => s.blockId === blockId);
    if (!segment) {
      continue;
    }
    const range = rangeAtPlainOffset(prose, segment.plainStart);
    if (!range) {
      continue;
    }
    if (range.getBoundingClientRect().top <= probeTop) {
      active = entry.anchorId;
    }
  }

  return active;
}
