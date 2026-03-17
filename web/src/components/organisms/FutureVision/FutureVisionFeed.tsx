'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFutureVisions, useFutureVisionTags } from '@/hooks/api/useFutureVisions';
import { FutureVisionCard } from './FutureVisionCard';
import { TagFilter } from './TagFilter';
import type { FutureVisionItem } from './FutureVisionCard';

export function FutureVisionFeed() {
  const t = useTranslations('common');
  const [page, setPage] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: platformSettings } = useFutureVisionTags();
  const rubricatorTags = platformSettings?.availableFutureVisionTags ?? [];

  const { data, isLoading } = useFutureVisions({
    page,
    pageSize: 20,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  });

  const items = (data?.items ?? []) as FutureVisionItem[];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const hasMore = page * pageSize < total;

  const tagsFromItems = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => item.futureVisionTags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [items]);

  const filterTags = rubricatorTags.length > 0 ? rubricatorTags : tagsFromItems;

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <TagFilter
        tags={filterTags}
        selectedTags={selectedTags}
        onToggleTag={handleToggleTag}
      />
      {isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">{t('noFutureVisionsYet')}</p>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.publicationId ?? item.communityId}>
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
              {t('loadMore')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
