'use client';

import { DocumentDraftCanvasBody } from '@/features/documents/components/DocumentDraftCanvasBody';
import { DocumentDraftStructureProvider } from '@/features/documents/context/DocumentDraftStructureContext';
import type { DocumentDraft } from '@/features/documents/lib/document-draft';
import { cn } from '@/lib/utils';

export interface CollaborativeDocumentDraftEditorProps {
  value: DocumentDraft;
  onChange: (draft: DocumentDraft) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Local collaborative-document editor (sections/blocks) for forms before a document exists.
 * Reuses structure UI from the live document canvas via DocumentStructureContext.
 */
export function CollaborativeDocumentDraftEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: CollaborativeDocumentDraftEditorProps) {
  return (
    <DocumentDraftStructureProvider
      value={value}
      onChange={onChange}
      disabled={disabled}
      blockPlaceholder={placeholder}
    >
      <div className={cn('space-y-4', className)}>
        <DocumentDraftCanvasBody />
      </div>
    </DocumentDraftStructureProvider>
  );
}
