import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { htmlToPlainText } from '@/features/documents/lib/document-text-diff';

type JoinableBlock = {
  id?: string;
  blockType?: string;
  officialContent?: string;
};

const LI_FRAGMENT_RE = /<li(?:\s[^>]*)?>[\s\S]*?<\/li>/gi;

/** One stored list block may be a single <li>, several <li>, or a full <ul>/<ol> from the editor. */
export function extractListItemFragments(html: string): string[] {
  const raw = (html ?? '').trim();
  if (!raw) {
    return [];
  }
  const items = [...raw.matchAll(LI_FRAGMENT_RE)].map((m) => m[0]!);
  if (items.length > 0) {
    return items;
  }
  return [`<li>${raw}</li>`];
}

/** Join blocks for read-only display (preview, diff). Wraps consecutive list blocks in ul/ol. */
export function joinBlocksToDisplayHtml(blocks: JoinableBlock[]): string {
  const parts: string[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index]!;
    const blockType = block.blockType ?? 'paragraph';

    if (blockType === 'list-bullet' || blockType === 'list-numbered') {
      const ordered = blockType === 'list-numbered';
      const tag = ordered ? 'ol' : 'ul';
      const items: string[] = [];

      while (index < blocks.length) {
        const current = blocks[index]!;
        if ((current.blockType ?? 'paragraph') !== blockType) {
          break;
        }
        items.push(...extractListItemFragments(current.officialContent ?? ''));
        index += 1;
      }

      if (items.length > 0) {
        parts.push(`<${tag}>${items.join('')}</${tag}>`);
      }
      continue;
    }

    const content = block.officialContent ?? '';
    if (content) {
      parts.push(content);
    }
    index += 1;
  }

  return parts.join('');
}

function blocksFromSections(sections: unknown): JoinableBlock[] {
  return groupBlocksBySection(sections).flatMap((g) => g.blocks);
}

export function joinDocumentBlocksToHtml(sections: unknown): string {
  return joinBlocksToDisplayHtml(blocksFromSections(sections));
}

/** Joined document HTML with one block replaced (variant preview in unified editor). */
export function joinDocumentWithBlockOverride(
  sections: unknown,
  blockId: string,
  blockHtml: string,
): string {
  const blocks = blocksFromSections(sections).map((b) =>
    b.id === blockId ? { ...b, officialContent: blockHtml } : b,
  );
  return joinBlocksToDisplayHtml(blocks);
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
