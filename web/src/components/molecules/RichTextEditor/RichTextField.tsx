'use client';

import { Textarea } from '@/components/ui/shadcn/textarea';
import { cn } from '@/lib/utils';
import { RichTextEditor } from './RichTextEditor';
import type { RichTextFieldProps } from './types';

/**
 * Drop-in rich text field. Use `plainText` for short comments and notes.
 */
export function RichTextField({
  value = '',
  onChange,
  placeholder,
  disabled = false,
  className,
  id,
  name,
  rows = 4,
  plainText = false,
  toolbar = 'default',
  documentActions,
  'aria-label': ariaLabel,
}: RichTextFieldProps) {
  if (plainText) {
    return (
      <Textarea
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        aria-label={ariaLabel}
        className={cn('rounded-xl', className)}
      />
    );
  }

  return (
    <RichTextEditor
      content={value}
      onChange={(html) => onChange?.(html)}
      placeholder={placeholder}
      editable={!disabled}
      toolbar={toolbar}
      documentActions={documentActions}
      className={cn(disabled && 'opacity-50 pointer-events-none', className)}
      minEditorHeight={`${Math.max(rows, 3) * 1.5}rem`}
    />
  );
}
