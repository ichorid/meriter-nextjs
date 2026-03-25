'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useCategories } from '@/hooks/api/useCategories';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Label } from '@/components/ui/shadcn/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategorySelectorProps {
  value: string[]; // Legacy category IDs and/or value rubricator tag strings (depending on mode)
  onChange: (categoryIds: string[]) => void;
  label?: string;
  helperText?: string;
  className?: string;
  maxCategories?: number; // Maximum number of categories that can be selected
  /** Platform value rubricator tags (decree 809 + admin extras). When set, legacy publication categories are not used. */
  rubricatorTags?: string[];
  rubricatorTagsLoading?: boolean;
  /** Shown in rubricator mode when the tag list is empty after load */
  emptyRubricatorMessage?: string;
}

/**
 * Multi-select chips: either legacy publication categories from API or platform value rubricator tags.
 */
export const CategorySelector: React.FC<CategorySelectorProps> = ({
  value = [],
  onChange,
  label,
  helperText,
  className,
  maxCategories,
  rubricatorTags,
  rubricatorTagsLoading,
  emptyRubricatorMessage,
}) => {
  const t = useTranslations('publications.create');
  const isRubricatorMode =
    rubricatorTagsLoading === true || rubricatorTags !== undefined;
  const { data: categories, isLoading: categoriesLoading } = useCategories({
    enabled: !isRubricatorMode,
  });

  const handleToggle = (categoryId: string) => {
    if (value.includes(categoryId)) {
      // Always allow deselecting
      onChange(value.filter(id => id !== categoryId));
    } else {
      // Check if we've reached the maximum limit
      if (maxCategories !== undefined && value.length >= maxCategories) {
        return; // Prevent adding more categories
      }
      onChange([...value, categoryId]);
    }
  };

  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    return [...categories].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  const rubricatorItems = useMemo(
    () => (rubricatorTags ?? []).map((tag) => ({ id: tag, name: tag })),
    [rubricatorTags],
  );

  const listItems = isRubricatorMode ? rubricatorItems : sortedCategories;
  const listLoading = isRubricatorMode ? !!rubricatorTagsLoading : categoriesLoading;

  if (listLoading) {
    return (
      <BrandFormControl label={label} helperText={helperText} className={className}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-base-content/50" />
        </div>
      </BrandFormControl>
    );
  }

  if (listItems.length === 0) {
    return (
      <BrandFormControl label={label} helperText={helperText} className={className}>
        <p className="text-sm text-base-content/60">
          {isRubricatorMode
            ? emptyRubricatorMessage ?? t('fields.noCategoriesAvailable')
            : t('fields.noCategoriesAvailable')}
        </p>
      </BrandFormControl>
    );
  }

  const isAtMaxLimit = maxCategories !== undefined && value.length >= maxCategories;

  return (
    <BrandFormControl label={label} helperText={helperText} className={className}>
      <div className="flex flex-wrap gap-3">
        {listItems.map((category) => {
          const isSelected = value.includes(category.id);
          const isDisabled = !isSelected && isAtMaxLimit;
          return (
            <div
              key={category.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                isSelected
                  ? 'bg-primary/10 border-primary text-primary cursor-pointer'
                  : isDisabled
                  ? 'bg-base-200 border-base-300 text-base-content/40 cursor-not-allowed opacity-50'
                  : 'bg-base-200 border-base-300 hover:bg-base-300 text-base-content cursor-pointer'
              )}
              onClick={() => !isDisabled && handleToggle(category.id)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => !isDisabled && handleToggle(category.id)}
                disabled={isDisabled}
                className="pointer-events-none"
              />
              <Label className={cn('text-sm font-medium', isDisabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                {category.name}
              </Label>
            </div>
          );
        })}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-base-content/60 mt-2">
          {maxCategories !== undefined
            ? `Selected: ${value.length}/${maxCategories}`
            : t('fields.selectedCategories', { count: value.length }) || 
              `Selected: ${value.length} categor${value.length === 1 ? 'y' : 'ies'}`}
        </p>
      )}
    </BrandFormControl>
  );
};


