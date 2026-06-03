'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import {
  documentEditorHtmlEquals,
  listArchivedDocumentEditorDrafts,
  removeArchivedDocumentEditorDraft,
  type DocumentEditorDraftArchiveEntry,
} from '@/features/documents/lib/document-editor-draft-archive';

export type DocumentEditorDraftRecoveryProps = {
  documentId: string;
  userId: string;
  refreshKey?: number;
  /** Official HTML currently on the server (or pending remote baseline). */
  serverBaselineHtml: string;
  /** Text currently shown in the editor. */
  editorHtml: string;
  serverRevisionLabel?: string | null;
  onShowServer: () => void;
  onRestore: (entry: DocumentEditorDraftArchiveEntry) => void;
  onListChange?: () => void;
};

function formatArchivedAt(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function DocumentEditorDraftRecovery({
  documentId,
  userId,
  refreshKey = 0,
  serverBaselineHtml,
  editorHtml,
  serverRevisionLabel,
  onShowServer,
  onRestore,
  onListChange,
}: DocumentEditorDraftRecoveryProps) {
  const t = useTranslations('pages.documents.gdocs');
  const locale = useLocale();

  const entries = useMemo(
    () => listArchivedDocumentEditorDrafts(documentId, userId),
    [documentId, userId, refreshKey],
  );

  const isServerActive = documentEditorHtmlEquals(editorHtml, serverBaselineHtml);

  const showPanel = entries.length > 0 || !isServerActive;

  if (!showPanel) {
    return null;
  }

  return (
    <div className="rounded-xl border border-stitch-border/60 bg-stitch-surface/40 px-3 py-2.5">
      <p className="mb-2 text-xs font-medium text-base-content/80">{t('versionPickerTitle')}</p>
      <ul className="flex flex-col divide-y divide-stitch-border/50">
        <li className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-base-content">{t('serverVersionLabel')}</p>
            {serverRevisionLabel ? (
              <p className="text-xs text-base-content/55">{serverRevisionLabel}</p>
            ) : null}
          </div>
          {isServerActive ? (
            <span
              className={cn(
                'shrink-0 rounded-lg border border-primary/35 bg-primary/15 px-2.5 py-1',
                'text-xs font-medium text-primary',
              )}
            >
              {t('versionActiveInEditor')}
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 rounded-lg px-2.5 text-xs"
              disabled={isServerActive}
              onClick={onShowServer}
            >
              {t('versionShow')}
            </Button>
          )}
        </li>

        {entries.map((entry) => {
          const isArchiveActive = documentEditorHtmlEquals(editorHtml, entry.html);
          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-base-content">{t('archivedDraftLabel')}</p>
                <p className="text-xs text-base-content/55">
                  {formatArchivedAt(entry.archivedAt, locale)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {isArchiveActive ? (
                  <span
                    className={cn(
                      'rounded-lg border border-primary/35 bg-primary/15 px-2.5 py-1',
                      'text-xs font-medium text-primary',
                    )}
                  >
                    {t('versionActiveInEditor')}
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg px-2.5 text-xs"
                    onClick={() => onRestore(entry)}
                  >
                    {t('archivedDraftRestore')}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg px-2.5 text-xs text-base-content/50 hover:text-base-content"
                  onClick={() => {
                    removeArchivedDocumentEditorDraft(documentId, userId, entry.id);
                    onListChange?.();
                  }}
                >
                  {t('archivedDraftDismiss')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
