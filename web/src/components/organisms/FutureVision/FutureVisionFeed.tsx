'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Scale, Filter, Search, X, Users } from 'lucide-react';
import { useFutureVisions, useFutureVisionTags } from '@/hooks/api/useFutureVisions';
import { useCanCreateCommunity } from '@/hooks/api/useProfile';
import { FutureVisionCard } from './FutureVisionCard';
import { TagFilter } from './TagFilter';
import { SortToggle } from '@/components/ui/SortToggle';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { routes } from '@/lib/constants/routes';
import type { FutureVisionItem } from './FutureVisionCard';

export interface FutureVisionFeedProps {
  onEarnMeritsClick?: () => void;
  tappalkaEnabled?: boolean;
}

const FV_TAG_QUERY = 'fvTag';

export function FutureVisionFeed({ onEarnMeritsClick, tappalkaEnabled = false }: FutureVisionFeedProps) {
  const t = useTranslations('common');
  const tCommunities = useTranslations('pages.communities');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreate: canCreateCommunity } = useCanCreateCommunity();
  const [page, setPage] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<'score' | 'createdAt'>('score');
  const [bOpenFilters, setBOpenFilters] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const { data: platformSettings } = useFutureVisionTags();
  const rubricatorTags = platformSettings?.availableFutureVisionTags ?? [];

  const { data, isLoading } = useFutureVisions({
    page,
    pageSize: 20,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    sort,
  });

  const rawItems = (data?.items ?? []) as FutureVisionItem[];
  const items = useMemo(() => {
    if (!searchQuery.trim()) return rawItems;
    const q = searchQuery.trim().toLowerCase();
    return rawItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.futureVisionText?.toLowerCase().includes(q) ?? false),
    );
  }, [rawItems, searchQuery]);
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const hasMore = page * pageSize < total;

  const tagsFromItems = useMemo(() => {
    const set = new Set<string>();
    rawItems.forEach((item) => item.futureVisionTags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [rawItems]);

  const filterTags = rubricatorTags.length > 0 ? rubricatorTags : tagsFromItems;

  const fvTagFromUrl = searchParams.get(FV_TAG_QUERY);

  useEffect(() => {
    if (!fvTagFromUrl) {
      return;
    }
    setSelectedTags([fvTagFromUrl]);
    setPage(1);
    setBOpenFilters(true);
  }, [fvTagFromUrl]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag];
      if (next.length === 0 && searchParams.get(FV_TAG_QUERY)) {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete(FV_TAG_QUERY);
        const q = nextParams.toString();
        const base = pathname ?? routes.futureVisions;
        queueMicrotask(() => {
          router.replace(q ? `${base}?${q}` : base, { scroll: false });
        });
      }
      return next;
    });
    setPage(1);
  };

  const handleSortChange = (value: 'recent' | 'voted') => {
    setSort(value === 'recent' ? 'createdAt' : 'score');
    setPage(1);
  };

  const handleOpenSearch = () => {
    setLocalSearchQuery(searchQuery);
    setShowSearchModal(true);
  };

  const handleCloseSearch = () => {
    setSearchQuery(localSearchQuery);
    setShowSearchModal(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-gray-100 dark:bg-gray-800/50 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {canCreateCommunity && (
              <Button
                onClick={() => router.push('/meriter/communities/create')}
                variant="outline"
                size="sm"
                className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-input bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-base-content text-base-content dark:text-base-content/70 h-9 rounded-xl px-3 gap-2"
                aria-label={t('createCommunity')}
              >
                <Users size={16} />
                {t('createCommunity')}
              </Button>
            )}
            {tappalkaEnabled && onEarnMeritsClick && (
              <Button
                onClick={onEarnMeritsClick}
                variant="outline"
                size="sm"
                className="inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-input bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-base-content text-base-content dark:text-base-content/70 h-9 rounded-xl px-3 gap-2 min-w-9"
                aria-label={t('earnMerits')}
              >
                <Scale size={16} className="shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">{t('earnMerits')}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenSearch}
              className="rounded-xl active:scale-[0.98] px-2"
              aria-label={t('search')}
              title={t('search')}
            >
              <Search size={18} className="text-base-content/70" />
            </Button>
            <div className="flex gap-0.5 bg-base-200/50 p-0.5 rounded-lg">
              <SortToggle
                value={sort === 'createdAt' ? 'recent' : 'voted'}
                onChange={handleSortChange}
                compact={true}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={bOpenFilters ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setBOpenFilters((s) => !s)}
              className="gap-2"
              aria-label={tCommunities('filters.title')}
            >
              <Filter className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">{tCommunities('filters.title')}</span>
            </Button>
          </div>
        </div>

        {bOpenFilters && (
          <div className="pt-1">
            <TagFilter
              tags={filterTags}
              selectedTags={selectedTags}
              onToggleTag={handleToggleTag}
            />
          </div>
        )}

        {!bOpenFilters && selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {selectedTags.slice(0, 5).map((tag) => (
              <span key={tag} className="text-xs text-base-content/70">
                {tag}
              </span>
            ))}
            {selectedTags.length > 5 && (
              <span className="text-xs text-base-content/50">
                +{selectedTags.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">{t('noFutureVisionsYet')}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-4 list-none p-0 m-0">
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

      {showSearchModal && (
        <BottomActionSheet
          isOpen={showSearchModal}
          onClose={handleCloseSearch}
          title={t('search')}
        >
          <div className="relative w-full">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="h-11 rounded-xl pl-10 pr-10"
              autoFocus
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={() => setLocalSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </BottomActionSheet>
      )}
    </div>
  );
}
