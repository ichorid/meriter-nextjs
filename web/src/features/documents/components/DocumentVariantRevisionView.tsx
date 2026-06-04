'use client';

import { Fragment, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { DocumentRichContent } from '@/features/documents/components/DocumentRichContent';
import {
  buildStructuredRevision,
  hasOfficialText,
  type RevisionToken,
  type StructuredRevision,
  variantDiffersFromOfficial,
} from '@/features/documents/lib/document-text-diff';
import { documentRevisionMarkupProseClass } from '@/features/documents/lib/document-revision-styles';
import { cn } from '@/lib/utils';

const revisionInsertClass =
  'rounded-sm bg-primary/25 px-1 font-semibold text-base-content no-underline ring-1 ring-inset ring-primary/40';
const revisionDeleteClass =
  'rounded-sm bg-error/30 px-1 font-medium text-error line-through decoration-error decoration-2';

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
  /** Full preview HTML when compare uses a narrower scope (e.g. single block). */
  displayVariantHtml?: string;
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
  /** Precomputed revision (e.g. document-scoped range diff). */
  structuredRevision?: StructuredRevision | null;
  /** Official HTML with <del>/<ins> marks; preserves headings and paragraphs when set. */
  revisionMarkupHtml?: string | null;
}

export function DocumentVariantRevisionView({
  officialHtml,
  variantHtml,
  displayVariantHtml,
  blockType,
  contentClassName,
  className,
  suppressDefaultPreview = false,
  compareMode: compareModeProp,
  onCompareModeChange,
  hideCompareToggle = false,
  structuredRevision: structuredRevisionProp,
  revisionMarkupHtml,
}: DocumentVariantRevisionViewProps) {
  const tCanvas = useTranslations('pages.documents.canvas');
  const wordDiffComparable =
    hasOfficialText(officialHtml) && variantDiffersFromOfficial(officialHtml, variantHtml);
  const canCompare =
    revisionMarkupHtml != null || structuredRevisionProp != null || wordDiffComparable;
  const [internalCompareMode, setInternalCompareMode] = useState(false);
  const compareMode = compareModeProp ?? internalCompareMode;
  const setCompareMode = onCompareModeChange ?? setInternalCompareMode;

  const structuredRevision = useMemo(
    () =>
      structuredRevisionProp ??
      (wordDiffComparable ? buildStructuredRevision(officialHtml, variantHtml, blockType) : null),
    [structuredRevisionProp, wordDiffComparable, officialHtml, variantHtml, blockType],
  );

  const showCompare = compareMode && canCompare;
  const showMarkup = showCompare && revisionMarkupHtml;
  const showTokenRevision = showCompare && !showMarkup && structuredRevision;

  return (
    <div className={className}>
      {showMarkup ? (
        <DocumentRichContent
          html={revisionMarkupHtml}
          blockType={blockType}
          className={cn(
            'text-sm leading-relaxed',
            documentRevisionMarkupProseClass,
            contentClassName,
          )}
        />
      ) : showTokenRevision ? (
        structuredRevision.kind === 'list' ? (
          <div className={cn('document-rich-content text-sm', contentClassName)}>
            {structuredRevision.ordered ? (
              <ol className="my-2">
                {structuredRevision.items.map((itemTokens, index) => (
                  <li key={index} className="leading-relaxed">
                    <RevisionTokenInline tokens={itemTokens} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="my-2">
                {structuredRevision.items.map((itemTokens, index) => (
                  <li key={index} className="leading-relaxed">
                    <RevisionTokenInline tokens={itemTokens} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className={cn('text-sm leading-relaxed', contentClassName)}>
            <RevisionTokenInline tokens={structuredRevision.tokens} />
          </div>
        )
      ) : suppressDefaultPreview ? null : (
        <DocumentRichContent
          html={displayVariantHtml ?? variantHtml}
          blockType={blockType}
          className={contentClassName}
        />
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
