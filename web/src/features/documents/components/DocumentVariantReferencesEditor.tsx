'use client';

import { useTranslations } from 'next-intl';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import {
  createEmptyReferenceDraft,
  MAX_DOCUMENT_VARIANT_REFERENCES,
  MAX_REFERENCE_SUMMARY_LENGTH,
  type DocumentVariantReferenceDraft,
  type DocumentVariantReferenceStance,
} from '@/features/documents/types/document-variant-reference';

export interface DocumentVariantReferencesEditorProps {
  value: DocumentVariantReferenceDraft[];
  onChange: (next: DocumentVariantReferenceDraft[]) => void;
  disabled?: boolean;
}

export function DocumentVariantReferencesEditor({
  value,
  onChange,
  disabled = false,
}: DocumentVariantReferencesEditorProps) {
  const t = useTranslations('pages.documents.references');

  const addRow = () => {
    if (value.length >= MAX_DOCUMENT_VARIANT_REFERENCES) return;
    onChange([...value, createEmptyReferenceDraft()]);
  };

  const updateRow = (id: string, patch: Partial<DocumentVariantReferenceDraft>) => {
    onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    onChange(value.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-3 rounded-lg border border-base-300/80 bg-base-100/30 p-3 dark:bg-base-100/5">
      <div className="flex items-center gap-2 text-sm font-medium text-base-content">
        <Link2 size={16} className="text-base-content/60" aria-hidden />
        {t('title')}
        <span className="text-xs font-normal text-base-content/50">
          {t('optionalHint', { max: MAX_DOCUMENT_VARIANT_REFERENCES })}
        </span>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-base-content/60">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {value.map((ref, index) => (
            <li
              key={ref.id}
              className="space-y-2 rounded-lg border border-base-300/60 bg-base-200/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-base-content/50">
                  {t('rowLabel', { n: index + 1 })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-base-content/60 hover:text-error"
                  disabled={disabled}
                  aria-label={t('remove')}
                  onClick={() => removeRow(ref.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <Input
                type="url"
                inputMode="url"
                placeholder={t('urlPlaceholder')}
                value={ref.url}
                disabled={disabled}
                className="h-10 rounded-lg border-base-300 bg-base-100 text-sm"
                onChange={(e) => updateRow(ref.id, { url: e.target.value })}
              />
              <Textarea
                placeholder={t('summaryPlaceholder')}
                value={ref.summary}
                disabled={disabled}
                maxLength={MAX_REFERENCE_SUMMARY_LENGTH}
                className="min-h-[64px] rounded-lg border-base-300 bg-base-100 text-sm"
                onChange={(e) => updateRow(ref.id, { summary: e.target.value })}
              />
              <Select
                value={ref.stance ?? 'none'}
                onValueChange={(v) =>
                  updateRow(ref.id, {
                    stance:
                      v === 'pro' || v === 'con'
                        ? (v as DocumentVariantReferenceStance)
                        : undefined,
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger className="h-9 w-full max-w-xs rounded-lg text-sm">
                  <SelectValue placeholder={t('stancePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('stanceNone')}</SelectItem>
                  <SelectItem value="pro">{t('stancePro')}</SelectItem>
                  <SelectItem value="con">{t('stanceCon')}</SelectItem>
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1 rounded-lg text-xs"
        disabled={disabled || value.length >= MAX_DOCUMENT_VARIANT_REFERENCES}
        onClick={addRow}
      >
        <Plus size={14} />
        {t('add')}
      </Button>
    </div>
  );
}
