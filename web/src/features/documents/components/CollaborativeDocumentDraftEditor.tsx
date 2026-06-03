'use client';

import { useMemo } from 'react';
import { RichTextEditor } from '@/components/molecules/RichTextEditor/RichTextEditor';
import type { DocumentDraft } from '@/features/documents/lib/document-draft';
import {
  draftToEditorHtml,
  updateDraftFromEditorHtml,
} from '@/features/documents/lib/document-draft';
import { cn } from '@/lib/utils';

export interface CollaborativeDocumentDraftEditorProps {
  value: DocumentDraft;
  onChange: (draft: DocumentDraft) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Single rich-text surface for pre-create collaborative document seeds.
 * Structure (sections/blocks) is derived when the community/project is saved.
 */
export function CollaborativeDocumentDraftEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: CollaborativeDocumentDraftEditorProps) {
  const html = useMemo(() => draftToEditorHtml(value), [value]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-stitch-border bg-stitch-canvas/80',
        className,
      )}
    >
      <RichTextEditor
        content={html}
        onChange={(next) => onChange(updateDraftFromEditorHtml(value, next))}
        placeholder={placeholder}
        editable={!disabled}
        toolbar="default"
        minEditorHeight="220px"
        editorClassName="min-h-[220px]"
      />
    </div>
  );
}
