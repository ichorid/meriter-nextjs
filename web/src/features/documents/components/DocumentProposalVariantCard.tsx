'use client';

import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { variantStatusToneClass } from '@/features/documents/lib/document-canvas-shared';

export type DocumentProposalVariantCardProps = {
  variantId: string;
  status: 'open' | 'closed-winner' | 'closed-not-winner' | 'applied' | 'withdrawn';
  proposedByDisplayName: string;
  proposedAt?: string | Date;
  proposerComment?: string | null;
  isActive: boolean;
  onSelect: () => void;
  trailing?: React.ReactNode;
};

function formatDate(value: string | Date | undefined, locale: string): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return null;
  }
}

export function DocumentProposalVariantCard({
  status,
  proposedByDisplayName,
  proposedAt,
  proposerComment,
  isActive,
  onSelect,
  trailing,
}: DocumentProposalVariantCardProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');
  const locale = useLocale();
  const dateLabel = formatDate(proposedAt, locale);
  const comment = proposerComment?.trim();

  return (
    <li>
      <div
        className={cn(
          'rounded-lg border transition-colors',
          isActive
            ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/25'
            : 'border-stitch-border bg-stitch-elevated/40',
        )}
      >
        <button
          type="button"
          className={cn(
            'w-full rounded-t-lg px-3 py-2.5 text-left transition-colors',
            'hover:bg-stitch-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            !trailing && 'rounded-b-lg',
          )}
          onClick={onSelect}
        >
          <div className="flex items-start gap-2">
            <span
              className={cn(
                'mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                variantStatusToneClass(status),
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-base-content">{proposedByDisplayName}</p>
              {dateLabel ? (
                <p className="text-[11px] text-base-content/50">{dateLabel}</p>
              ) : null}
              {comment ? (
                <p className="mt-2 text-xs leading-relaxed text-base-content/80">
                  <span className="font-medium text-base-content/55">
                    {tGdocs('proposerCommentLabel')}:{' '}
                  </span>
                  <span className="line-clamp-4">{comment}</span>
                </p>
              ) : null}
            </div>
          </div>
        </button>
        {trailing ? (
          <div className="flex flex-col gap-2 border-t border-stitch-border/50 px-3 py-3">
            {trailing}
          </div>
        ) : null}
      </div>
    </li>
  );
}
