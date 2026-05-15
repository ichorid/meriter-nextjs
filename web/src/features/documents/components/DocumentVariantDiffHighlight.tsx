'use client';

import { Fragment, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import {
  hasOfficialText,
  liteWordDiff,
  variantDiffersFromOfficial,
} from '@/features/documents/lib/document-text-diff';
import { cn } from '@/lib/utils';

const DIFF_MARK_CLASS =
  'rounded-sm border border-primary/50 bg-base-300/90 px-1 py-px font-medium text-base-content';

export interface DocumentVariantDiffHighlightProps {
  officialHtml: string;
  variantHtml: string;
  className?: string;
  contentClassName?: string;
}

export function DocumentVariantDiffHighlight({
  officialHtml,
  variantHtml,
  className,
  contentClassName,
}: DocumentVariantDiffHighlightProps) {
  const tCanvas = useTranslations('pages.documents.canvas');

  const canDiff = hasOfficialText(officialHtml);

  const tokens = useMemo(
    () => (canDiff ? liteWordDiff(officialHtml, variantHtml) : null),
    [canDiff, officialHtml, variantHtml],
  );

  const showDiffHint = useMemo(
    () => canDiff && variantDiffersFromOfficial(officialHtml, variantHtml),
    [canDiff, officialHtml, variantHtml],
  );

  if (!tokens) {
    return (
      <div className={className}>
        <DocumentRichContent html={variantHtml} className={contentClassName} />
      </div>
    );
  }

  return (
    <div className={className}>
      {showDiffHint ? (
        <p className="mb-1 text-[10px] text-base-content/45">{tCanvas('diffHint')}</p>
      ) : null}
      <p className={cn('text-sm leading-relaxed text-base-content/95', contentClassName)}>
        {tokens.map((token, index) => (
          <Fragment key={`${index}-${token.value}`}>
            {token.kind === 'add' ? (
              <mark className={DIFF_MARK_CLASS}>{token.value}</mark>
            ) : (
              <span>{token.value}</span>
            )}{' '}
          </Fragment>
        ))}
      </p>
    </div>
  );
}
