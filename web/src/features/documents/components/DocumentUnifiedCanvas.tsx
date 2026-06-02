'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import { groupBlocksBySection } from '@/features/documents/lib/document-canvas-shared';
import { useDocumentCanvasFocus } from '@/features/documents/context/DocumentCanvasFocusContext';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

function officialTypographyClass(blockType: string): string {
  switch (blockType) {
    case 'quote':
      return 'border-l-2 border-base-content/25 pl-4 italic';
    case 'list-bullet':
    case 'list-numbered':
      return '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5';
    default:
      return '';
  }
}

export interface DocumentUnifiedCanvasProps {
  sections: unknown;
  documentId: string;
  readOnly?: boolean;
}

export function DocumentUnifiedCanvas({
  sections,
  documentId,
  readOnly = true,
}: DocumentUnifiedCanvasProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');
  const focus = useDocumentCanvasFocus();
  const threadsQuery = trpc.documentVariants.listByDocument.useQuery(
    { documentId },
    { enabled: !!documentId },
  );

  const blocks = useMemo(
    () => groupBlocksBySection(sections).flatMap((g) => g.blocks),
    [sections],
  );

  const openRangesByBlock = useMemo(() => {
    const map = new Map<string, Array<{ variantId: string; start: number; end: number }>>();
    for (const thread of threadsQuery.data?.threads ?? []) {
      for (const variant of thread.variants) {
        if (variant.status !== 'open' && variant.status !== 'closed-winner') {
          continue;
        }
        const start = variant.rangeStart ?? 0;
        const end =
          variant.rangeEnd ??
          (thread.officialExcerpt?.length ? thread.officialExcerpt.length : 9999);
        const list = map.get(thread.blockId) ?? [];
        list.push({ variantId: variant.id, start, end });
        map.set(thread.blockId, list);
      }
    }
    return map;
  }, [threadsQuery.data?.threads]);

  const handleMouseUp = useCallback(
    (blockId: string, blockHtml: string) => {
      if (!readOnly || !focus) {
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        return;
      }
      const root = document.getElementById(`block-${blockId}`);
      if (!root) {
        return;
      }
      const preRange = document.createRange();
      preRange.selectNodeContents(root);
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        return;
      }
      preRange.setEnd(range.startContainer, range.startOffset);
      const rangeStart = preRange.toString().length;
      const excerpt = range.toString();
      const rangeEnd = rangeStart + excerpt.length;
      if (rangeEnd <= rangeStart) {
        return;
      }
      const block = focus.getBlock(blockId);
      if (block?.proposalsLocked) {
        focus.addToast(tGdocs('proposalsLocked'), 'warning');
        return;
      }
      focus.setFocusedBlockId(blockId);
      focus.setSelectedRange({
        blockId,
        rangeStart,
        rangeEnd,
        excerpt,
        blockType: block?.blockType ?? 'paragraph',
        officialHtml: blockHtml,
      });
    },
    [readOnly, focus, tGdocs],
  );

  return (
    <div className="document-unified-canvas space-y-4 text-base leading-relaxed text-base-content/95">
      {blocks.map((block) => {
        const html = block.officialContent ?? '';
        const isFocused = focus?.focusedBlockId === block.id;
        const hasActivity = openRangesByBlock.has(block.id);
        return (
          <div
            key={block.id}
            id={`block-${block.id}`}
            data-block-id={block.id}
            role="article"
            tabIndex={0}
            className={cn(
              'relative rounded-lg transition-colors',
              isFocused && 'ring-1 ring-primary/40',
              hasActivity && 'border-l-2 border-primary/60 pl-3',
              block.proposalsLocked && 'opacity-90',
            )}
            onMouseUp={() => handleMouseUp(block.id, html)}
            onClick={() => {
              focus?.setFocusedBlockId(block.id);
              focus?.setFocusedVariantId(null);
            }}
          >
            {block.proposalsLocked ? (
              <span className="mb-1 inline-block text-[10px] uppercase tracking-wide text-base-content/45">
                {tGdocs('lockedBadge')}
              </span>
            ) : null}
            <div className={officialTypographyClass(block.blockType)}>
              <DocumentRichContent html={html} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
