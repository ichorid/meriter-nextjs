'use client';

import { Fragment, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import {
  buildRevisionTokens,
  hasOfficialText,
  variantDiffersFromOfficial,
} from '@/features/documents/lib/document-text-diff';
import { cn } from '@/lib/utils';

export interface DocumentVariantRevisionViewProps {
  officialHtml: string;
  variantHtml: string;
  contentClassName?: string;
  className?: string;
}

export function DocumentVariantRevisionView({
  officialHtml,
  variantHtml,
  contentClassName,
  className,
}: DocumentVariantRevisionViewProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const canCompare = hasOfficialText(officialHtml) && variantDiffersFromOfficial(officialHtml, variantHtml);
  const [compareMode, setCompareMode] = useState(false);

  const revisionTokens = useMemo(
    () => (canCompare ? buildRevisionTokens(officialHtml, variantHtml) : null),
    [canCompare, officialHtml, variantHtml],
  );

  const showCompare = compareMode && canCompare && revisionTokens;

  return (
    <div className={className}>
      {showCompare ? (
        <p className={cn('text-sm leading-relaxed', contentClassName)}>
          {revisionTokens.map((token, index) => (
            <Fragment key={`${index}-${token.kind}-${token.value}`}>
              {token.kind === 'same' ? (
                <span className="text-base-content/90">{token.value}</span>
              ) : token.kind === 'delete' ? (
                <del className="text-base-content/45 decoration-base-content/40">{token.value}</del>
              ) : (
                <ins className="font-medium text-base-content no-underline">{token.value}</ins>
              )}{' '}
            </Fragment>
          ))}
        </p>
      ) : (
        <DocumentRichContent html={variantHtml} className={contentClassName} />
      )}

      {canCompare ? (
        <div className="mt-2 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-lg px-2.5 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setCompareMode((v) => !v);
          }}
        >
          {showCompare ? tCanvas('viewClean') : tCanvas('viewCompare')}
        </Button>
        </div>
      ) : null}
    </div>
  );
}
