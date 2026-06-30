'use client';

import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import type { VariantDisplayPreview } from '@/features/documents/lib/document-variant-preview';
import { cn } from '@/lib/utils';

const insertClass =
  'rounded-sm bg-primary/25 px-0.5 font-semibold text-base-content no-underline ring-1 ring-inset ring-primary/40';
const deleteClass =
  'rounded-sm bg-error/30 px-1 font-medium text-error line-through decoration-error decoration-2';

export interface DocumentVariantContextPreviewProps {
  preview: VariantDisplayPreview;
  blockType?: string;
  className?: string;
}

export function DocumentVariantContextPreview({
  preview,
  blockType,
  className,
}: DocumentVariantContextPreviewProps) {
  return (
    <div className={cn('space-y-1 text-sm leading-relaxed', className)}>
      {preview.segments.map((segment, index) => {
        if (segment.kind === 'context') {
          return (
            <p
              key={`ctx-${index}`}
              className="whitespace-pre-wrap break-words text-base-content/50"
            >
              {segment.text}
            </p>
          );
        }
        if (segment.kind === 'delete') {
          return (
            <p key={`del-${index}`} className="whitespace-pre-wrap break-words">
              <del className={deleteClass}>{segment.text}</del>
            </p>
          );
        }
        return (
          <div
            key={`ins-${index}`}
            className={cn(
              'rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5',
              insertClass,
            )}
          >
            <DocumentRichContent
              html={segment.html}
              blockType={blockType}
              className="text-sm leading-relaxed text-base-content [&_p]:my-0"
            />
          </div>
        );
      })}
    </div>
  );
}
