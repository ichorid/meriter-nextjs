'use client';

import { RichTextEditor } from './RichTextEditor';
import { CollaborativeDocumentDraftEditor } from '@/features/documents/components/CollaborativeDocumentDraftEditor';
import type { DocumentDraft } from '@/features/documents/lib/document-draft';
import type {
  DocumentStructureToolbarActions,
  RichTextEditorProps,
  RichTextToolbarVariant,
} from './types';

export type MeriterEditorMode = 'basic' | 'collaborative-document';

interface MeriterEditorBaseProps {
  placeholder?: string;
  className?: string;
  editable?: boolean;
  disabled?: boolean;
}

export interface MeriterEditorBasicProps extends MeriterEditorBaseProps {
  mode?: 'basic';
  content: string;
  onChange: (content: string) => void;
  toolbar?: RichTextToolbarVariant;
  documentActions?: DocumentStructureToolbarActions;
  editorClassName?: string;
  minEditorHeight?: string;
}

export interface MeriterEditorCollaborativeProps extends MeriterEditorBaseProps {
  mode: 'collaborative-document';
  value: DocumentDraft;
  onChange: (draft: DocumentDraft) => void;
}

export type MeriterEditorProps = MeriterEditorBasicProps | MeriterEditorCollaborativeProps;

function isCollaborativeProps(
  props: MeriterEditorProps,
): props is MeriterEditorCollaborativeProps {
  return props.mode === 'collaborative-document';
}

export function MeriterEditor(props: MeriterEditorProps) {
  if (isCollaborativeProps(props)) {
    const { value, onChange, placeholder, className, disabled } = props;
    return (
      <CollaborativeDocumentDraftEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
    );
  }

  const {
    content,
    onChange,
    placeholder,
    className,
    editable,
    disabled,
    toolbar = 'default',
    documentActions,
    editorClassName,
    minEditorHeight,
  } = props;

  const richProps: RichTextEditorProps = {
    content,
    onChange,
    placeholder,
    className,
    editable: disabled ? false : editable,
    toolbar,
    documentActions,
    editorClassName,
    minEditorHeight,
  };

  return <RichTextEditor {...richProps} />;
}
