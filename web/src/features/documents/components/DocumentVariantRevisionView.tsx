'use client';

import { Fragment, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import {
  buildStructuredRevision,
  hasOfficialText,
  type RevisionToken,
  variantDiffersFromOfficial,
} from '@/features/documents/lib/document-text-diff';
import { cn } from '@/lib/utils';

const revisionInsertClass =
  'rounded-sm bg-primary/25 px-0.5 font-semibold text-base-content no-underline ring-1 ring-inset ring-primary/40';
const revisionDeleteClass =
  'rounded-sm bg-error/15 px-0.5 text-base-content/55 line-through decoration-error/70 decoration-2';

function RevisionTokenInline({
  tokens,
  className,
}: {
  tokens: RevisionToken[];
  className?: string;
}) {
  return (
    <span className={cn('leading-relaxed', className)}>
      {tokens.map((token, index) => (
        <Fragment key={`${index}-${token.kind}-${token.value}`}>
          {token.kind === 'same' ? (
            <span className="text-base-content/90">{token.value}</span>
          ) : token.kind === 'delete' ? (
            <del className={revisionDeleteClass}>{token.value}</del>
          ) : (
            <ins className={revisionInsertClass}>{token.value}</ins>
          )}{' '}
        </Fragment>
      ))}
    </span>
  );
}

export interface DocumentVariantRevisionViewProps {
  officialHtml: string;
  variantHtml: string;
  blockType?: string;
  contentClassName?: string;
  className?: string;
  /** When set, default full-body preview is omitted (e.g. contextual preview shown above). */
  suppressDefaultPreview?: boolean;
  /** Controlled diff mode; when omitted, internal toggle is used. */
  compareMode?: boolean;
  onCompareModeChange?: (value: boolean) => void;
  /** Hide inline compare toggle (parent provides toolbar control). */
  hideCompareToggle?: boolean;
}

export function DocumentVariantRevisionView({
  officialHtml,
  variantHtml,
  blockType,
  contentClassName,
  className,
  suppressDefaultPreview = false,
  compareMode: compareModeProp,
  onCompareModeChange,
  hideCompareToggle = false,
}: DocumentVariantRevisionViewProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const canCompare = hasOfficialText(officialHtml) && variantDiffersFromOfficial(officialHtml, variantHtml);
  const [internalCompareMode, setInternalCompareMode] = useState(false);
  const compareMode = compareModeProp ?? internalCompareMode;
  const setCompareMode = onCompareModeChange ?? setInternalCompareMode;

  const structuredRevision = useMemo(
    () => (canCompare ? buildStructuredRevision(officialHtml, variantHtml, blockType) : null),
    [canCompare, officialHtml, variantHtml, blockType],
  );

  const showCompare = compareMode && canCompare && structuredRevision;

  return (
    <div className={className}>
      {showCompare ? (
        structuredRevision.kind === 'list' ? (
          structuredRevision.ordered ? (
            <ol
              className={cn(
                'my-1 list-decimal space-y-1 pl-5 text-sm',
                contentClassName,
              )}
            >
              {structuredRevision.items.map((itemTokens, index) => (
                <li key={index} className="pl-0 leading-relaxed">
                  <RevisionTokenInline tokens={itemTokens} />
                </li>
              ))}
            </ol>
          ) : (
            <ul
              className={cn(
                'my-1 list-disc space-y-1 pl-5 text-sm',
                contentClassName,
              )}
            >
              {structuredRevision.items.map((itemTokens, index) => (
                <li key={index} className="pl-0 leading-relaxed">
                  <RevisionTokenInline tokens={itemTokens} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className={cn('text-sm leading-relaxed', contentClassName)}>
            <RevisionTokenInline tokens={structuredRevision.tokens} />
          </div>
        )
      ) : suppressDefaultPreview ? null : (
        <DocumentRichContent html={variantHtml} blockType={blockType} className={contentClassName} />
      )}

      {canCompare && !hideCompareToggle ? (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-lg px-2.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setCompareMode(!compareMode);
            }}
          >
            {showCompare ? tCanvas('viewClean') : tCanvas('viewCompare')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
