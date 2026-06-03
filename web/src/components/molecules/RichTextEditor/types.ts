import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/core';

/** Standard formatting toolbar only. */
export type RichTextToolbarVariant = 'default' | 'document' | 'minimal' | 'none';

/** Actions for collaborative document structure (§7.4, §20.2 TZ). */
export interface DocumentStructureToolbarActions {
  onAddSection?: () => void;
  onAddBlock?: () => void;
  onPinOfficial?: () => void;
  onCloseVoting?: () => void;
  onApplyAdminOverride?: () => void;
  disabled?: boolean;
}

export interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  /** `document` adds structure tools row (collaborative docs only). */
  toolbar?: RichTextToolbarVariant;
  documentActions?: DocumentStructureToolbarActions;
  editorClassName?: string;
  minEditorHeight?: string;
  /** Plain-text UTF-16 spans to highlight as admin-pinned (GDocs editor). */
  lockedRanges?: Array<{ rangeStart: number; rangeEnd: number }>;
  lockedRangeTooltip?: string;
  /** Second toolbar row below formatting controls (e.g. GDocs save/pin). */
  toolbarSecondary?: ReactNode;
}

export interface RichTextFieldProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  rows?: number;
  'aria-label'?: string;
  /** Use plain `<textarea>` instead of WYSIWYG (comments, short notes). */
  plainText?: boolean;
  toolbar?: RichTextToolbarVariant;
  documentActions?: DocumentStructureToolbarActions;
}

export type { Editor };
