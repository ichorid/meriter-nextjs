'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Switch } from '@/components/ui/shadcn/switch';
import { Label } from '@/components/ui/shadcn/label';
import { DocumentVariantRevisionView } from '@/features/documents/components/DocumentVariantRevisionView';
import type { DocumentVariantPreviewTarget } from '@/features/documents/context/DocumentCanvasFocusContext';
import { mergeRangeIntoBlockHtmlWithRevisionMarks } from '@/features/documents/lib/document-block-merge';
import {
  buildDocumentVariantRevisionMarkupHtml,
  blockOfficialHtmlFromSections,
} from '@/features/documents/lib/document-variant-document-preview';
import {
  buildStructuredRevision,
  hasOfficialText,
  type StructuredRevision,
  variantDiffersFromOfficial,
} from '@/features/documents/lib/document-text-diff';
import { documentRevisionMarkupProseClass } from '@/features/documents/lib/document-revision-styles';
import type { VariantPreviewInput } from '@/features/documents/lib/document-variant-preview';
import { cn } from '@/lib/utils';

export type DocumentVariantMainPreviewProps = {
  target: DocumentVariantPreviewTarget;
  showDiff: boolean;
  onShowDiffChange: (value: boolean) => void;
  onClose: () => void;
};

function formatProposedAt(value: string | Date | undefined, locale: string): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return null;
  }
}

export function DocumentVariantMainPreview({
  target,
  showDiff,
  onShowDiffChange,
  onClose,
}: DocumentVariantMainPreviewProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');
  const locale = useLocale();

  const isOfficialRow = target.kind === 'official';
  const variantHtml = isOfficialRow ? target.officialHtml : target.variantHtml;

  const compareOfficialHtml = target.compareOfficialHtml ?? target.officialHtml;
  const compareVariantHtml = target.compareVariantHtml ?? variantHtml;

  const variantPreviewInput = useMemo((): VariantPreviewInput | null => {
    if (isOfficialRow || target.kind !== 'variant') {
      return null;
    }
    return {
      content: target.variantHtml,
      rangeStart: target.rangeStart,
      rangeEnd: target.rangeEnd,
      proposedText: target.proposedText,
    };
  }, [isOfficialRow, target]);

  const revisionMarkupHtml = useMemo((): string | null => {
    if (!variantPreviewInput || target.kind !== 'variant') {
      return null;
    }
    if (target.sectionsForRevision != null) {
      const blockOfficial = blockOfficialHtmlFromSections(
        target.sectionsForRevision,
        target.blockId,
      );
      return buildDocumentVariantRevisionMarkupHtml(
        target.sectionsForRevision,
        target.blockId,
        blockOfficial,
        variantPreviewInput,
      );
    }
    if (
      typeof target.rangeStart === 'number' &&
      typeof target.rangeEnd === 'number' &&
      target.proposedText != null
    ) {
      return mergeRangeIntoBlockHtmlWithRevisionMarks(
        compareOfficialHtml,
        target.rangeStart,
        target.rangeEnd,
        target.proposedText,
      );
    }
    return null;
  }, [variantPreviewInput, target, compareOfficialHtml]);

  const canCompare = useMemo(
    () =>
      !isOfficialRow &&
      (revisionMarkupHtml != null ||
        (hasOfficialText(compareOfficialHtml) &&
          variantDiffersFromOfficial(compareOfficialHtml, compareVariantHtml))),
    [isOfficialRow, revisionMarkupHtml, compareOfficialHtml, compareVariantHtml],
  );

  const structuredRevision = useMemo((): StructuredRevision | null => {
    if (!canCompare || revisionMarkupHtml) {
      return null;
    }
    return buildStructuredRevision(compareOfficialHtml, compareVariantHtml);
  }, [canCompare, revisionMarkupHtml, compareOfficialHtml, compareVariantHtml]);

  const title = isOfficialRow
    ? tGdocs('previewOfficialTitle')
    : tGdocs('previewVariantTitle', {
        name: target.proposedByDisplayName ?? tGdocs('previewUnknownAuthor'),
      });

  const proposedAtLabel = formatProposedAt(target.proposedAt, locale);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-stitch-border bg-stitch-surface/60 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold tracking-tight text-base-content">{title}</p>
          {proposedAtLabel ? (
            <p className="text-xs text-base-content/55">{proposedAtLabel}</p>
          ) : null}
          {!isOfficialRow && target.proposerComment?.trim() ? (
            <p className="text-xs leading-relaxed text-base-content/75">
              <span className="font-medium text-base-content/60">{tGdocs('proposerCommentLabel')}: </span>
              {target.proposerComment.trim()}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          {canCompare ? (
            <div className="flex items-center gap-2">
              <Switch
                id="variant-show-diff"
                checked={showDiff}
                onCheckedChange={onShowDiffChange}
              />
              <Label htmlFor="variant-show-diff" className="cursor-pointer text-xs text-base-content/80">
                {tGdocs('showEditsToggle')}
              </Label>
            </div>
          ) : null}
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={onClose}>
            {tGdocs('backToEditing')}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'min-h-[12rem] min-w-0 overflow-x-hidden rounded-xl border border-stitch-border bg-stitch-canvas/80 px-4 py-4',
          'text-base leading-relaxed',
        )}
      >
        <DocumentVariantRevisionView
          officialHtml={compareOfficialHtml}
          variantHtml={compareVariantHtml}
          displayVariantHtml={variantHtml}
          structuredRevision={structuredRevision}
          revisionMarkupHtml={revisionMarkupHtml}
          compareMode={showDiff && canCompare}
          onCompareModeChange={onShowDiffChange}
          hideCompareToggle
          contentClassName={cn('text-base', documentRevisionMarkupProseClass)}
        />
      </div>
    </div>
  );
}
