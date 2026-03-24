'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Separator } from '@/components/ui/shadcn/separator';
import { CollapsibleSection } from '@/components/ui/taxonomy/CollapsibleSection';
import { VALUE_TAGS_MAX_PER_POST } from '@meriter/shared-types/value-rubricator';

export interface ValuesFormPickerFieldsProps {
  decree809Tags: string[];
  adminExtrasTags: string[];
  valueTags: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function ValuesFormPickerFields({
  decree809Tags,
  adminExtrasTags,
  valueTags,
  onChange,
  disabled,
}: ValuesFormPickerFieldsProps) {
  const t = useTranslations('valuesRubricator');
  const [sectionOpen, setSectionOpen] = useState(true);
  const [custom, setCustom] = useState('');

  const toggle = (tag: string) => {
    if (disabled) return;
    const lower = tag.trim().toLowerCase();
    if (valueTags.some((x) => x.toLowerCase() === lower)) {
      onChange(valueTags.filter((x) => x.toLowerCase() !== lower));
    } else if (valueTags.length < VALUE_TAGS_MAX_PER_POST) {
      onChange([...valueTags, tag]);
    }
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v || disabled) return;
    const lower = v.toLowerCase();
    if (valueTags.some((x) => x.toLowerCase() === lower)) {
      setCustom('');
      return;
    }
    if (valueTags.length >= VALUE_TAGS_MAX_PER_POST) return;
    onChange([...valueTags, v]);
    setCustom('');
  };

  const renderGroup = (title: string, tags: string[]) => {
    if (tags.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
          {title}
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const selected = valueTags.some(
              (x) => x.toLowerCase() === tag.toLowerCase(),
            );
            return (
              <Button
                key={tag}
                type="button"
                variant={selected ? 'default' : 'outline'}
                size="sm"
                disabled={disabled}
                className="h-auto min-h-9 whitespace-normal text-left py-1.5"
                onClick={() => toggle(tag)}
              >
                {tag}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <CollapsibleSection
      title={t('formSectionTitle')}
      summary={t('formSectionHelp')}
      open={sectionOpen}
      setOpen={setSectionOpen}
    >
      <div className="space-y-4 border-t border-base-300 pt-4">
        {renderGroup(t('decree809Section'), decree809Tags)}
        {decree809Tags.length > 0 && adminExtrasTags.length > 0 && (
          <Separator />
        )}
        {renderGroup(t('adminExtrasSection'), adminExtrasTags)}
        <Separator />
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            {t('customLabel')}
          </p>
          <div className="flex flex-wrap gap-2">
            {valueTags
              .filter(
                (vt) =>
                  !decree809Tags.some(
                    (d) => d.toLowerCase() === vt.toLowerCase(),
                  ) &&
                  !adminExtrasTags.some(
                    (a) => a.toLowerCase() === vt.toLowerCase(),
                  ),
              )
              .map((vt) => (
                <Button
                  key={vt}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    onChange(valueTags.filter((x) => x !== vt))
                  }
                >
                  {vt} ×
                </Button>
              ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={t('customPlaceholder')}
              disabled={disabled}
              className="h-10 rounded-xl flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled || !custom.trim()}
              onClick={addCustom}
            >
              {t('customAdd')}
            </Button>
          </div>
          <p className="text-xs text-base-content/50">
            {t('maxTags', { max: VALUE_TAGS_MAX_PER_POST })}
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
