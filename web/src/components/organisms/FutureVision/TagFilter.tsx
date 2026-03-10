'use client';

import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { cn } from '@/lib/utils';

export interface TagFilterProps {
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  className?: string;
}

export function TagFilter({ tags, selectedTags, onToggleTag, className }: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => {
        const isSelected = selectedTags.includes(tag);
        return (
          <Button
            key={tag}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggleTag(tag)}
          >
            {tag}
          </Button>
        );
      })}
    </div>
  );
}
