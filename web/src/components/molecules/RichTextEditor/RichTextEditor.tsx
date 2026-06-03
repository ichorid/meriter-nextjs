'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { createEditorExtensions } from './create-editor-extensions';
import { createLockedRangeHighlightExtension } from './locked-range-highlight-extension';
import { FormatToolbar } from './FormatToolbar';
import { DocumentStructureToolbar } from './DocumentStructureToolbar';
import type { RichTextEditorProps } from './types';

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  className,
  editable = true,
  toolbar = 'default',
  documentActions,
  editorClassName,
  minEditorHeight = '150px',
  lockedRanges = [],
  lockedRangeTooltip = '',
}: RichTextEditorProps) {
  const showDocumentToolbar = toolbar === 'document';
  const lockedRangesRef = useRef(lockedRanges);
  const lockedTooltipRef = useRef(lockedRangeTooltip);
  lockedRangesRef.current = lockedRanges;
  lockedTooltipRef.current = lockedRangeTooltip;

  const highlightExtension = useMemo(
    () =>
      createLockedRangeHighlightExtension({
        getRanges: () => lockedRangesRef.current,
        getTooltip: () => lockedTooltipRef.current,
      }),
    [],
  );

  const lockedRangesKey = useMemo(
    () => lockedRanges.map((r) => `${r.rangeStart}:${r.rangeEnd}`).join(','),
    [lockedRanges],
  );

  const editor = useEditor({
    extensions: [...createEditorExtensions({ placeholder }), highlightExtension],
    content: content || '',
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm sm:prose-base dark:prose-invert text-base-content focus:outline-none p-4 max-w-none',
          editorClassName,
        ),
        style: `--min-editor-height: ${minEditorHeight}`,
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.view.dispatch(editor.state.tr);
  }, [editor, lockedRangesKey, lockedRangeTooltip]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const current = editor.getHTML();
    const next = content || '';
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  const showFormatToolbar = editable && toolbar !== 'none';

  return (
    <div
      className={cn(
        'shadow-none rounded-xl overflow-hidden bg-base-100 focus-within:ring-2 focus-within:ring-brand-primary/20 transition-shadow',
        className,
      )}
    >
      {showFormatToolbar ? (
        <div className="rounded-t-xl overflow-hidden">
          {showDocumentToolbar ? <DocumentStructureToolbar actions={documentActions} /> : null}
          <FormatToolbar editor={editor} variant={toolbar} disabled={!editable} />
        </div>
      ) : null}
      <EditorContent
        editor={editor}
        className={cn('[&_.ProseMirror]:min-h-[var(--min-editor-height,150px)]')}
      />
    </div>
  );
}
