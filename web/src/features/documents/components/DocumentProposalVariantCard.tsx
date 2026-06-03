'use client';

import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { variantStatusLabelKey, variantStatusToneClass } from '@/features/documents/lib/document-canvas-shared';

export type DocumentProposalVariantCardProps = {
  variantId: string;
  status: 'open' | 'closed-winner' | 'closed-not-winner' | 'applied' | 'withdrawn';
  rating: number;
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
  rating,
  proposedByDisplayName,
  proposedAt,
  proposerComment,
  isActive,
  onSelect,
  trailing,
}: DocumentProposalVariantCardProps) {
  const t = useTranslations('pages.documents');
  const locale = useLocale();
  const dateLabel = formatDate(proposedAt, locale);
  const comment = proposerComment?.trim();

  return (
    <li>
      <button
        type="button"
        className={cn(
          'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
          isActive
            ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/25'
            : 'border-stitch-border bg-stitch-elevated/40 hover:bg-stitch-elevated',
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
              <p className="mt-1 line-clamp-3 text-xs leading-snug text-base-content/70">{comment}</p>
            ) : null}
            <p className="mt-1.5 text-[11px] text-base-content/55">
              {t(variantStatusLabelKey(status))} · {t('rating', { rating })}
            </p>
          </div>
        </div>
        {trailing ? (
          <div
            className="mt-2 flex flex-col gap-1.5 border-t border-stitch-border/50 pt-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {trailing}
          </div>
        ) : null}
      </button>
    </li>
  );
}
