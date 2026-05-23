/**
 * Rebuilds collaborative-document sections from community `futureVisionText` mirror
 * (see DocumentService.concatOfficialPlainText). Block types cannot be recovered — paragraphs only.
 */

export interface MirrorSectionBlock {
  order: number;
  blockType: string;
  officialContent: string;
}

export interface MirrorSection {
  title?: string;
  order: number;
  blocks: MirrorSectionBlock[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bodyToParagraphBlocks(body: string): MirrorSectionBlock[] {
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return [];
  }
  return paragraphs.map((p, order) => ({
    order,
    blockType: 'paragraph',
    officialContent: `<p>${escapeHtml(p)}</p>`,
  }));
}

export function parseFutureVisionMirrorToInitialSections(
  plain: string,
): MirrorSection[] | undefined {
  const trimmed = plain.trim();
  if (!trimmed) {
    return undefined;
  }

  const parts = trimmed.split(/\n\n(?=# )/);
  const sections: MirrorSection[] = [];

  for (let sectionIndex = 0; sectionIndex < parts.length; sectionIndex += 1) {
    const part = parts[sectionIndex] ?? '';
    const titled = part.match(/^# (.+?)(?:\n\n([\s\S]*))?$/);
    if (titled) {
      const title = titled[1]?.trim() ?? '';
      const body = titled[2] ?? '';
      const blocks = bodyToParagraphBlocks(body);
      if (title || blocks.length > 0) {
        sections.push({ title, order: sectionIndex, blocks });
      }
      continue;
    }

    const blocks = bodyToParagraphBlocks(part);
    if (blocks.length > 0) {
      sections.push({ title: '', order: sectionIndex, blocks });
    }
  }

  return sections.length > 0 ? sections : undefined;
}
