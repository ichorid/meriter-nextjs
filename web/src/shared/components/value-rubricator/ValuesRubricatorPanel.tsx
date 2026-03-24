'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/shadcn/separator';

export interface ValuesRubricatorPanelProps {
  decree809Tags: string[];
  adminExtrasTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  className?: string;
}

function filterByQuery(tags: string[], q: string): string[] {
  const s = q.trim().toLowerCase();
  if (!s) return tags;
  return tags.filter((t) => t.toLowerCase().includes(s));
}

export function ValuesRubricatorPanel({
  decree809Tags,
  adminExtrasTags,
  selectedTags,
  onToggleTag,
  className,
}: ValuesRubricatorPanelProps) {
  const t = useTranslations('valuesRubricator');
  const [query, setQuery] = useState('');

  const filtered809 = useMemo(
    () => filterByQuery(decree809Tags, query),
    [decree809Tags, query],
  );
  const filteredExtra = useMemo(
    () => filterByQuery(adminExtrasTags, query),
    [adminExtrasTags, query],
  );

  const renderChips = (tags: string[]) => (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag);
        return (
          <Button
            key={tag}
            type="button"
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            className="h-auto min-h-9 whitespace-normal text-left py-1.5"
            onClick={() => onToggleTag(tag)}
          >
            {tag}
          </Button>
        );
      })}
    </div>
  );

  if (decree809Tags.length === 0 && adminExtrasTags.length === 0) {
    return <p className="text-sm text-base-content/60">{t('emptyRubricator')}</p>;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-sm text-base-content/70">{t('panelHelp')}</p>
      <div className="relative">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-10 rounded-xl"
          aria-label={t('searchPlaceholder')}
        />
      </div>
      {decree809Tags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            {t('decree809Section')}
          </p>
          {filtered809.length > 0 ? (
            renderChips(filtered809)
          ) : (
            <p className="text-xs text-base-content/50">{t('noMatch')}</p>
          )}
        </div>
      )}
      {decree809Tags.length > 0 && adminExtrasTags.length > 0 && (
        <Separator className="my-2" />
      )}
      {adminExtrasTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            {t('adminExtrasSection')}
          </p>
          {filteredExtra.length > 0 ? (
            renderChips(filteredExtra)
          ) : (
            <p className="text-xs text-base-content/50">{t('noMatch')}</p>
          )}
        </div>
      )}
    </div>
  );
}
