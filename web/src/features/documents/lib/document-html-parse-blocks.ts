import type { MeriterBlockType } from '@/features/documents/types/document-block';

export type ParsedStructureBlock = {
  blockType: MeriterBlockType;
  officialContent: string;
  order: number;
};

/** Mirrors API parseDocumentHtmlToBlocks for draft seed serialization. */
export function parseDocumentHtmlToBlocks(html: string): ParsedStructureBlock[] {
  const source = (html ?? '').trim();
  if (!source) {
    return [];
  }

  const blocks: ParsedStructureBlock[] = [];
  let order = 0;

  const nodeRegex =
    /<(p|h1|h2|h3|ul|ol|blockquote)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = nodeRegex.exec(source)) !== null) {
    const tag = match[1]!.toLowerCase();
    const chunk = match[0]!;
    if (tag === 'ul' || tag === 'ol') {
      const listType: MeriterBlockType =
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

    const blockType: MeriterBlockType =
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

  if (blocks.length === 0 && source) {
    blocks.push({
      blockType: 'paragraph',
      officialContent: source.includes('<p') ? source : `<p>${source}</p>`,
      order: 0,
    });
  }

  return blocks;
}
