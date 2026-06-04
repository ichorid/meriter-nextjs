'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { createEditorExtensions } from './create-editor-extensions';
import { createLockedRangeHighlightExtension } from './locked-range-highlight-extension';
import { createProposalRangeHighlightExtension } from './proposal-range-highlight-extension';
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
  proposalHighlightRanges = [],
  toolbarSecondary,
}: RichTextEditorProps) {
  const showDocumentToolbar = toolbar === 'document';
  const lockedRangesRef = useRef(lockedRanges);
  const lockedTooltipRef = useRef(lockedRangeTooltip);
  const proposalRangesRef = useRef(proposalHighlightRanges);
  lockedRangesRef.current = lockedRanges;
  lockedTooltipRef.current = lockedRangeTooltip;
  proposalRangesRef.current = proposalHighlightRanges;

  const lockedHighlightExtension = useMemo(
    () =>
      createLockedRangeHighlightExtension({
        getRanges: () => lockedRangesRef.current,
        getTooltip: () => lockedTooltipRef.current,
      }),
    [],
  );

  const proposalHighlightExtension = useMemo(
    () =>
      createProposalRangeHighlightExtension({
        getRanges: () => proposalRangesRef.current,
      }),
    [],
  );

  const lockedRangesKey = useMemo(
    () => lockedRanges.map((r) => `${r.rangeStart}:${r.rangeEnd}`).join(','),
    [lockedRanges],
  );

  const proposalRangesKey = useMemo(
    () =>
      proposalHighlightRanges
        .map((r) => `${r.rangeStart}:${r.rangeEnd}:${r.tooltip.length}`)
        .join('|'),
    [proposalHighlightRanges],
  );

  const editor = useEditor({
    extensions: [
      ...createEditorExtensions({ placeholder }),
      lockedHighlightExtension,
      proposalHighlightExtension,
    ],
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
  }, [editor, lockedRangesKey, lockedRangeTooltip, proposalRangesKey]);

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
        <div
          className={cn(
            'rounded-t-xl overflow-hidden',
            toolbarSecondary ? 'border-b border-base-300 bg-base-200' : null,
          )}
        >
          {showDocumentToolbar ? <DocumentStructureToolbar actions={documentActions} /> : null}
          <FormatToolbar
            editor={editor}
            variant={toolbar}
            disabled={!editable}
            embedded={Boolean(toolbarSecondary)}
          />
          {toolbarSecondary ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-2 pb-2 pt-0 sm:gap-2 sm:px-3">
              {toolbarSecondary}
            </div>
          ) : null}
        </div>
      ) : null}
      <EditorContent
        editor={editor}
        className={cn('[&_.ProseMirror]:min-h-[var(--min-editor-height,150px)]')}
      />
    </div>
  );
}
