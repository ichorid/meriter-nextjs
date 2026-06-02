'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DocumentBlockEditor } from '@/features/documents/components/DocumentBlockEditor';
import { joinDocumentBlocksToHtml } from '@/features/documents/lib/document-html-structure';
import { trpc } from '@/lib/trpc/client';

const SYNC_DEBOUNCE_MS = 800;

export interface DocumentLeadUnifiedEditorProps {
  documentId: string;
  sections: unknown;
  updatedAt?: string | Date | null;
  onSynced?: () => void;
}

export function DocumentLeadUnifiedEditor({
  documentId,
  sections,
  updatedAt,
  onSynced,
}: DocumentLeadUnifiedEditorProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');
  const utils = trpc.useUtils();
  const initialHtml = useMemo(() => joinDocumentBlocksToHtml(sections), [sections]);
  const htmlRef = useRef(initialHtml);
  const [editorKey, setEditorKey] = useState(0);
  const expectedUpdatedAtRef = useRef(updatedAt);

  useEffect(() => {
    expectedUpdatedAtRef.current = updatedAt;
    htmlRef.current = initialHtml;
    setEditorKey((k) => k + 1);
  }, [documentId, initialHtml, updatedAt]);

  const syncMutation = trpc.documents.syncStructureFromHtml.useMutation({
    onSuccess: async (result) => {
      expectedUpdatedAtRef.current = result.document.updatedAt;
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByDocument.invalidate({ documentId });
      onSynced?.();
    },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueSync = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      syncMutation.mutate({
        documentId,
        html: htmlRef.current,
        expectedUpdatedAt: expectedUpdatedAtRef.current
          ? new Date(expectedUpdatedAtRef.current)
          : undefined,
      });
    }, SYNC_DEBOUNCE_MS);
  }, [documentId, syncMutation]);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-base-content/55">{tGdocs('leadEditorHint')}</p>
      <DocumentBlockEditor
        key={`lead-doc-${documentId}-${editorKey}`}
        blockType="paragraph"
        content={initialHtml}
        onChange={(html) => {
          htmlRef.current = html;
          queueSync();
        }}
        placeholder={tGdocs('leadEditorPlaceholder')}
        disabled={syncMutation.isPending}
      />
      {syncMutation.isError ? (
        <p className="text-xs text-error">{syncMutation.error.message}</p>
      ) : null}
    </div>
  );
}
