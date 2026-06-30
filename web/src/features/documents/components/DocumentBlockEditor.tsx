'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { RichTextEditor } from '@/components/molecules/RichTextEditor';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import type { MeriterBlockType } from '@/features/documents/types/document-block';
import {
  parseHeadingContent,
  parseListItems,
  parseQuoteInnerHtml,
  serializeHeadingContent,
  serializeListItems,
  serializeQuoteContent,
  type HeadingLevel,
} from '@/features/documents/lib/block-content-format';
import { cn } from '@/lib/utils';

export interface DocumentBlockEditorProps {
  blockType: MeriterBlockType | string;
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function HeadingBlockEditor({
  content,
  onChange,
  placeholder,
  disabled,
}: Pick<DocumentBlockEditorProps, 'content' | 'onChange' | 'placeholder' | 'disabled'>) {
  const t = useTranslations('pages.documents.structure');
  const initial = parseHeadingContent(content);
  const [level, setLevel] = useState<HeadingLevel>(initial.level);
  const [text, setText] = useState(initial.text);
  const lastSerializedRef = useRef(content);

  useEffect(() => {
    if (content === lastSerializedRef.current) {
      return;
    }
    lastSerializedRef.current = content;
    const parsed = parseHeadingContent(content);
    setLevel(parsed.level);
    setText(parsed.text);
  }, [content]);

  const emit = (nextLevel: HeadingLevel, nextText: string) => {
    const html = serializeHeadingContent(nextLevel, nextText);
    lastSerializedRef.current = html;
    onChange(html);
  };

  return (
    <div className="space-y-2 rounded-xl border border-input bg-background p-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('headingLevel')}>
        {([2, 3] as const).map((lvl) => (
          <Button
            key={lvl}
            type="button"
            size="sm"
            variant={level === lvl ? 'secondary' : 'outline'}
            className="h-8 min-w-[3rem] rounded-lg text-xs font-semibold"
            disabled={disabled}
            onClick={() => {
              setLevel(lvl);
              emit(lvl, text);
            }}
          >
            H{lvl}
          </Button>
        ))}
      </div>
      <Input
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          emit(level, next);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'h-auto border-0 bg-transparent px-0 shadow-none focus-visible:ring-0',
          level === 2 && 'text-xl font-semibold tracking-tight',
          level === 3 && 'text-lg font-semibold tracking-tight',
        )}
      />
    </div>
  );
}

function ListBlockEditor({
  content,
  onChange,
  ordered,
  placeholder,
  disabled,
}: Pick<DocumentBlockEditorProps, 'content' | 'onChange' | 'placeholder' | 'disabled'> & {
  ordered: boolean;
}) {
  const t = useTranslations('pages.documents.structure');
  const [items, setItems] = useState(() => parseListItems(content, ordered));
  const lastSerializedRef = useRef(content);

  useEffect(() => {
    if (content === lastSerializedRef.current) {
      return;
    }
    lastSerializedRef.current = content;
    setItems(parseListItems(content, ordered));
  }, [content, ordered]);

  const updateItems = (next: string[]) => {
    const normalized = next.length > 0 ? next : [''];
    const html = serializeListItems(normalized, ordered);
    lastSerializedRef.current = html;
    setItems(normalized);
    onChange(html);
  };

  return (
    <div className="space-y-2 rounded-xl border border-input bg-background p-3">
      <ul className={cn('space-y-2', ordered ? 'list-none' : 'list-none')}>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              className="flex h-8 w-6 shrink-0 items-center justify-center text-sm text-base-content/50"
              aria-hidden
            >
              {ordered ? `${index + 1}.` : '•'}
            </span>
            <Input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[index] = e.target.value;
                updateItems(next);
              }}
              placeholder={placeholder ?? t('listItemPlaceholder')}
              disabled={disabled}
              className="h-9 flex-1 rounded-lg"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-base-content/50 hover:text-error"
              disabled={disabled || items.length <= 1}
              aria-label={t('removeListItem')}
              onClick={() => {
                const next = items.filter((_, i) => i !== index);
                updateItems(next);
              }}
            >
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 rounded-lg border-dashed text-xs"
        disabled={disabled}
        onClick={() => updateItems([...items, ''])}
      >
        <Plus size={14} />
        {t('addListItem')}
      </Button>
    </div>
  );
}

function QuoteBlockEditor({
  content,
  onChange,
  placeholder,
  disabled,
}: Pick<DocumentBlockEditorProps, 'content' | 'onChange' | 'placeholder' | 'disabled'>) {
  const inner = parseQuoteInnerHtml(content);

  return (
    <RichTextEditor
      content={inner}
      onChange={(html) => onChange(serializeQuoteContent(html))}
      placeholder={placeholder}
      editable={!disabled}
      toolbar="minimal"
      className="rounded-xl border border-input bg-background"
      minEditorHeight="88px"
      editorClassName="border-l-2 border-base-content/25 pl-3 italic text-base-content/90"
    />
  );
}

export function DocumentBlockEditor({
  blockType,
  content,
  onChange,
  placeholder,
  disabled,
  className,
}: DocumentBlockEditorProps) {
  const type = (blockType || 'paragraph') as MeriterBlockType;

  let editor: ReactNode;
  switch (type) {
    case 'heading':
      editor = (
        <HeadingBlockEditor
          content={content}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
      break;
    case 'list-bullet':
      editor = (
        <ListBlockEditor
          content={content}
          onChange={onChange}
          ordered={false}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
      break;
    case 'list-numbered':
      editor = (
        <ListBlockEditor
          content={content}
          onChange={onChange}
          ordered
          placeholder={placeholder}
          disabled={disabled}
        />
      );
      break;
    case 'quote':
      editor = (
        <QuoteBlockEditor
          content={content}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
      break;
    case 'paragraph':
    default:
      editor = (
        <RichTextEditor
          content={content || '<p></p>'}
          onChange={onChange}
          placeholder={placeholder}
          editable={!disabled}
          toolbar="default"
          className="min-h-[140px] rounded-xl border border-input bg-background"
          minEditorHeight="120px"
        />
      );
  }

  return <div className={className}>{editor}</div>;
}
