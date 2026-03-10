'use client';

import { useMemo, useState } from 'react';
import { useFutureVisions } from '@/hooks/api/useFutureVisions';
import { FutureVisionCard } from './FutureVisionCard';
import { TagFilter } from './TagFilter';
import type { FutureVisionItem } from './FutureVisionCard';

export function FutureVisionFeed() {
  const [page, setPage] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data, isLoading } = useFutureVisions({
    page,
    pageSize: 20,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  });

  const items = (data?.items ?? []) as FutureVisionItem[];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const hasMore = page * pageSize < total;

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => item.futureVisionTags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <TagFilter
        tags={allTags}
        selectedTags={selectedTags}
        onToggleTag={handleToggleTag}
      />
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">No future visions yet.</p>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.communityId}>
                <FutureVisionCard item={item} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setPage((p) => p + 1)}
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
