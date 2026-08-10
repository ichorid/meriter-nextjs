'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Filter, Search, X, UserPlus } from 'lucide-react';
import { useFutureVisions } from '@/hooks/api/useFutureVisions';
import { useCanCreateCommunity } from '@/hooks/api/useProfile';
import { FutureVisionCard } from './FutureVisionCard';
import { ValuesRubricatorPanel } from '@/shared/components/value-rubricator/ValuesRubricatorPanel';
import { usePlatformValueRubricatorSections } from '@/shared/hooks/usePlatformValueRubricator';
import { SortToggle } from '@/components/ui/SortToggle';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { routes } from '@/lib/constants/routes';
import type { FutureVisionItem } from './FutureVisionCard';
import { documentSectionsSearchPlainText } from '@/features/documents/lib/document-canvas-shared';

const FV_TAG_QUERY = 'fvTag';

function futureVisionItemKey(item: FutureVisionItem): string {
  return item.publicationId ?? item.communityId;
}

export function FutureVisionFeed() {
  const t = useTranslations('common');
  const tValues = useTranslations('valuesRubricator');
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
  const [accumulatedItems, setAccumulatedItems] = useState<FutureVisionItem[]>([]);

  const { sections } = usePlatformValueRubricatorSections();

  const { data, isLoading, isFetching } = useFutureVisions({
    page,
    pageSize: 20,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    sort,
  });

  useEffect(() => {
    setPage(1);
    setAccumulatedItems([]);
  }, [selectedTags, sort]);

  useEffect(() => {
    const pageItems = (data?.items ?? []) as FutureVisionItem[];
    if (!data) {
      return;
    }
    if (page === 1) {
      setAccumulatedItems(pageItems);
      return;
    }
    setAccumulatedItems((prev) => {
      const seen = new Set(prev.map(futureVisionItemKey));
      const appended = pageItems.filter((item) => !seen.has(futureVisionItemKey(item)));
      return appended.length === 0 ? prev : [...prev, ...appended];
    });
  }, [data, page]);

  const items = useMemo(() => {
    if (!searchQuery.trim()) return accumulatedItems;
    const q = searchQuery.trim().toLowerCase();
    return accumulatedItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.futureVisionText?.toLowerCase().includes(q) ?? false) ||
        documentSectionsSearchPlainText(item.futureVisionDocumentSections).includes(q),
    );
  }, [accumulatedItems, searchQuery]);
  const total = data?.total ?? 0;
  const hasMore = accumulatedItems.length < total;
  const showInitialLoading = isLoading && page === 1 && accumulatedItems.length === 0;

  const tagsFromItems = useMemo(() => {
    const set = new Set<string>();
    accumulatedItems.forEach((item) => item.futureVisionTags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [accumulatedItems]);

  const decree809ForPanel = sections.decree809;
  const adminExtrasForPanel = useMemo(() => {
    if (sections.adminExtras.length > 0) {
      return sections.adminExtras;
    }
    if (decree809ForPanel.length === 0 && tagsFromItems.length > 0) {
      return tagsFromItems;
    }
    return tagsFromItems.filter(
      (tag) =>
        !decree809ForPanel.some(
          (d) => d.toLowerCase() === tag.toLowerCase(),
        ),
    );
  }, [sections.adminExtras, decree809ForPanel, tagsFromItems]);

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

  const dismissSearchModal = () => {
    setLocalSearchQuery(searchQuery);
    setShowSearchModal(false);
  };

  const applyFvSearch = () => {
    setSearchQuery(localSearchQuery.trim());
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
                className="inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-input bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-base-content text-base-content dark:text-base-content/70 h-9 rounded-xl px-2 sm:px-3 gap-2 min-w-9"
                aria-label={t('createCommunity')}
                title={t('createCommunity')}
              >
                <UserPlus size={16} className="shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">{t('createCommunity')}</span>
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
              aria-label={tValues('openButton')}
            >
              <Filter className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">{tValues('openButton')}</span>
            </Button>
          </div>
        </div>

        {bOpenFilters && (
          <div className="pt-1">
            <ValuesRubricatorPanel
              decree809Tags={decree809ForPanel}
              adminExtrasTags={adminExtrasForPanel}
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

      {showInitialLoading ? (
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
              className="text-primary hover:underline disabled:opacity-50"
              disabled={isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              {isFetching ? t('loading') : t('loadMore')}
            </button>
          )}
        </>
      )}

      {showSearchModal && (
        <BottomActionSheet
          isOpen={showSearchModal}
          onClose={dismissSearchModal}
          title={t('search')}
          footer={
            <Button type="submit" form="fv-search-form" className="h-11 w-full rounded-xl text-base font-medium">
              {t('find')}
            </Button>
          }
        >
          <form
            id="fv-search-form"
            className="space-y-1"
            onSubmit={(e) => {
              e.preventDefault();
              applyFvSearch();
            }}
          >
            <div className="relative w-full">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                enterKeyHint="search"
                placeholder={t('searchPlaceholder')}
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="h-11 rounded-xl pl-10 pr-10"
                autoFocus
              />
              {localSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setLocalSearchQuery('')}
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={t('clearSearch')}
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>
          </form>
        </BottomActionSheet>
      )}
    </div>
  );
}
