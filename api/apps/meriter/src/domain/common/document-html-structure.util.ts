import { randomUUID } from 'crypto';
import { sanitizeDocumentHtml } from '../../common/utils/sanitize-document-html';
import { blockHtmlToPlainText } from './document-plain-text.util';
import type { DocumentBlockType } from '../ports/document.persistence.port';

export type ParsedStructureBlock = {
  blockType: DocumentBlockType;
  officialContent: string;
  order: number;
};

const SIMILARITY_THRESHOLD = 0.72;

export function parseDocumentHtmlToBlocks(html: string): ParsedStructureBlock[] {
  const sanitized = sanitizeDocumentHtml(html ?? '');
  if (!sanitized.trim()) {
    return [];
  }

  const blocks: ParsedStructureBlock[] = [];
  let order = 0;

  const nodeRegex =
    /<(p|h1|h2|h3|ul|ol|blockquote)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  let match: RegExpExecArray | null;
  const source = sanitized;

  while ((match = nodeRegex.exec(source)) !== null) {
    const tag = match[1]!.toLowerCase();
    const chunk = match[0]!;
    if (tag === 'ul' || tag === 'ol') {
      const listType: DocumentBlockType =
        tag === 'ol' ? 'list-numbered' : 'list-bullet';
      const liRegex = /<li(?:\s[^>]*)?>[\s\S]*?<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRegex.exec(chunk)) !== null) {
        blocks.push({
          blockType: listType,
          officialContent: liMatch[0]!,
          order: order++,
        });
      }
      continue;
    }

    const blockType: DocumentBlockType =
      tag === 'blockquote'
        ? 'quote'
        : tag.startsWith('h')
          ? 'heading'
          : 'paragraph';

    blocks.push({
      blockType,
      officialContent: chunk,
      order: order++,
    });
  }

  if (blocks.length === 0 && sanitized.trim()) {
    blocks.push({
      blockType: 'paragraph',
      officialContent: sanitized.includes('<p')
        ? sanitized
        : `<p>${sanitized}</p>`,
      order: 0,
    });
  }

  return blocks;
}

export type ExistingBlockForMapping = {
  id: string;
  order: number;
  blockType: DocumentBlockType;
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
};

export type MappedStructureBlock = ExistingBlockForMapping & {
  officialContent: string;
};

export type BlockMappingReport = {
  preserved: string[];
  created: string[];
  removed: string[];
};

export function mapStableBlockIds(
  existingBlocks: ExistingBlockForMapping[],
  parsed: ParsedStructureBlock[],
): { blocks: MappedStructureBlock[]; report: BlockMappingReport } {
  const usedIds = new Set<string>();
  const preserved: string[] = [];
  const created: string[] = [];
  const removed: string[] = [];

  const remaining = [...existingBlocks].sort((a, b) => a.order - b.order);

  const blocks: MappedStructureBlock[] = parsed.map((parsedBlock, index) => {
    const matchIdx = findBestMatchIndex(remaining, parsedBlock, index);
    if (matchIdx >= 0) {
      const [matched] = remaining.splice(matchIdx, 1);
      usedIds.add(matched.id);
      preserved.push(matched.id);
      return {
        ...matched,
        order: parsedBlock.order,
        blockType: parsedBlock.blockType,
        officialContent: parsedBlock.officialContent,
      };
    }
    const id = randomUUID();
    created.push(id);
    return {
      id,
      order: parsedBlock.order,
      blockType: parsedBlock.blockType,
      officialContent: parsedBlock.officialContent,
      proposalsLocked: false,
      officialRating: 0,
      editHistory: [],
    };
  });

  for (const leftover of remaining) {
    removed.push(leftover.id);
  }

  return {
    blocks,
    report: { preserved, created, removed },
  };
}

function findBestMatchIndex(
  candidates: ExistingBlockForMapping[],
  parsed: ParsedStructureBlock,
  orderHint: number,
): number {
  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    if (c.blockType !== parsed.blockType) {
      continue;
    }
    const orderBonus = Math.abs(c.order - orderHint) <= 1 ? 0.1 : 0;
    const sim = textSimilarity(
      blockHtmlToPlainText(c.officialContent ?? ''),
      blockHtmlToPlainText(parsed.officialContent),
    );
    const score = sim + orderBonus;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestScore >= SIMILARITY_THRESHOLD ? bestIdx : -1;
}

function textSimilarity(a: string, b: string): number {
  if (a === b) {
    return 1;
  }
  if (!a.length || !b.length) {
    return 0;
  }
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length < b.length ? a : b;
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j]!, dp[j - 1]!);
      prev = tmp;
    }
  }
  return dp[n]!;
}

const LI_FRAGMENT_RE = /<li(?:\s[^>]*)?>[\s\S]*?<\/li>/gi;

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

export function joinBlocksToDocumentHtml(
  blocks: Array<{ blockType?: DocumentBlockType; officialContent: string }>,
): string {
  const parts: string[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index]!;
    const blockType = block.blockType ?? 'paragraph';

    if (blockType === 'list-bullet' || blockType === 'list-numbered') {
      const tag = blockType === 'list-numbered' ? 'ol' : 'ul';
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
