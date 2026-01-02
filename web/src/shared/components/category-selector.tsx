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
  value: string[]; // Array of category IDs
  onChange: (categoryIds: string[]) => void;
  label?: string;
  helperText?: string;
  className?: string;
}

/**
 * Category selector component
 * Allows users to select one or more predefined categories
 */
export const CategorySelector: React.FC<CategorySelectorProps> = ({
  value = [],
  onChange,
  label,
  helperText,
  className,
}) => {
  const t = useTranslations('publications.create');
  const { data: categories, isLoading } = useCategories();

  const handleToggle = (categoryId: string) => {
    if (value.includes(categoryId)) {
      onChange(value.filter(id => id !== categoryId));
    } else {
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

  if (isLoading) {
    return (
      <BrandFormControl label={label} helperText={helperText} className={className}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-base-content/50" />
        </div>
      </BrandFormControl>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <BrandFormControl label={label} helperText={helperText} className={className}>
        <p className="text-sm text-base-content/60">
          {t('fields.noCategoriesAvailable') || 'No categories available'}
        </p>
      </BrandFormControl>
    );
  }

  return (
    <BrandFormControl label={label} helperText={helperText} className={className}>
      <div className="flex flex-wrap gap-3">
        {sortedCategories.map((category) => {
          const isSelected = value.includes(category.id);
          return (
            <div
              key={category.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer',
                isSelected
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-base-200 border-base-300 hover:bg-base-300 text-base-content'
              )}
              onClick={() => handleToggle(category.id)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggle(category.id)}
                className="pointer-events-none"
              />
              <Label className="cursor-pointer text-sm font-medium">
                {category.name}
              </Label>
            </div>
          );
        })}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-base-content/60 mt-2">
          {t('fields.selectedCategories', { count: value.length }) || 
           `Selected: ${value.length} categor${value.length === 1 ? 'y' : 'ies'}`}
        </p>
      )}
    </BrandFormControl>
  );
};


