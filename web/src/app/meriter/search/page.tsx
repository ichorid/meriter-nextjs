'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, FileText, MessageSquare, BarChart3, Users, User, Hash } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { AdvancedSearch, SearchParams as AdvancedSearchParams } from '@/components/organisms/AdvancedSearch';
import { useSearch } from '@/hooks/api/useSearch';
import { InfoCard } from '@/components/ui/InfoCard';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Loader2 } from 'lucide-react';
import type { SearchContentType } from '@/types/api-v1';

export default function SearchResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('search');

  const initialParams = searchParams ?? new URLSearchParams();

  const [searchParamsState, setSearchParamsState] = useState<AdvancedSearchParams>({
    query: initialParams.get('q') || '',
    contentType: (initialParams.get('type') as SearchContentType) || 'all',
    tags: initialParams.get('tags')?.split(',').filter(Boolean) || [],
    dateFrom: initialParams.get('from') || undefined,
    dateTo: initialParams.get('to') || undefined,
  });

  const { data: searchResults, isLoading } = useSearch({
    query: searchParamsState.query,
    contentType: searchParamsState.contentType,
    tags: searchParamsState.tags,
    dateFrom: searchParamsState.dateFrom,
    dateTo: searchParamsState.dateTo,
    page: 1,
    pageSize: 50,
  });

  const handleSearch = (params: AdvancedSearchParams) => {
    setSearchParamsState(params);

    // Update URL
    const newSearchParams = new URLSearchParams();
    if (params.query) newSearchParams.set('q', params.query);
    if (params.contentType && params.contentType !== 'all') {
      newSearchParams.set('type', params.contentType);
    }
    if (params.tags?.length) {
      newSearchParams.set('tags', params.tags.join(','));
    }
    if (params.dateFrom) newSearchParams.set('from', params.dateFrom);
    if (params.dateTo) newSearchParams.set('to', params.dateTo);

    router.push(`/meriter/search?${newSearchParams.toString()}`);
  };

  // Group results by type
  const groupedResults = React.useMemo(() => {
    if (!searchResults?.results) return {};

    const grouped: Record<string, typeof searchResults.results> = {};
    searchResults.results.forEach((result) => {
      const type = result.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type]!.push(result);
    });

    return grouped;
  }, [searchResults]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'publications':
        return <FileText size={20} className="text-blue-500" />;
      case 'comments':
        return <MessageSquare size={20} className="text-green-500" />;
      case 'polls':
        return <BarChart3 size={20} className="text-purple-500" />;
      case 'communities':
        return <Users size={20} className="text-orange-500" />;
      default:
        return <Search size={20} />;
    }
  };

  const getTypeLabel = (type: string) => {
    return t(`results.${type}`) || type;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <AdaptiveLayout
      stickyHeader={<SimpleStickyHeader title={t('results.title')} showBack={true} asStickyHeader={true} showScrollToTop={true} />}
    >
      <div className="space-y-6">
        {/* Search Input */}
        <AdvancedSearch
          onSearch={handleSearch}
          initialQuery={searchParamsState.query}
        />

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <span className="ml-3 text-brand-text-secondary">
              {t('results.loading')}
            </span>
          </div>
        ) : searchResults && searchResults.results.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedResults).map(([type, results]) => (
              <div key={type} className="space-y-3">
                <div className="flex items-center gap-2 text-lg font-semibold text-brand-text-primary">
                  {getTypeIcon(type)}
                  <span>{getTypeLabel(type)}</span>
                  <span className="text-sm text-brand-text-secondary font-normal">
                    ({results.length})
                  </span>
                </div>

                <div className="space-y-2">
                  {results.map((result) => {
                    // Build subtitle string
                    const subtitleParts: string[] = [];
                    if (result.description) {
                      subtitleParts.push(result.description.substring(0, 100));
                    }
                    const metaParts: string[] = [];
                    if (result.author) {
                      metaParts.push(result.author.name);
                    }
                    if (result.community) {
                      metaParts.push(result.community.name);
                    }
                    if (result.createdAt) {
                      metaParts.push(formatDate(result.createdAt));
                    }
                    if (metaParts.length > 0) {
                      subtitleParts.push(metaParts.join(' • '));
                    }
                    if (result.tags && result.tags.length > 0) {
                      subtitleParts.push(`#${result.tags.join(', #')}`);
                    }

                    return (
                      <InfoCard
                        key={`${result.type}-${result.id}`}
                        title={result.title}
                        subtitle={subtitleParts.join(' | ')}
                        icon={
                          result.author?.avatarUrl ? (
                            <Avatar className="w-8 h-8 text-xs">
                              {result.author.avatarUrl && (
                                <AvatarImage src={result.author.avatarUrl} alt={result.author.name} />
                              )}
                              <AvatarFallback userId={result.author.id} className="font-medium uppercase">
                                {result.author.name ? result.author.name.slice(0, 2).toUpperCase() : <User size={14} />}
                              </AvatarFallback>
                            </Avatar>
                          ) : result.community?.avatarUrl ? (
                            <Avatar className="w-8 h-8 text-xs">
                              {result.community.avatarUrl && (
                                <AvatarImage src={result.community.avatarUrl} alt={result.community.name} />
                              )}
                              <AvatarFallback communityId={result.community.id} className="font-medium uppercase">
                                {result.community.name ? result.community.name.slice(0, 2).toUpperCase() : <User size={14} />}
                              </AvatarFallback>
                            </Avatar>
                          ) : undefined
                        }
                        onClick={() => router.push(result.url)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : searchParamsState.query || searchParamsState.tags?.length ? (
          <div className="text-center py-12 text-base-content/60">
            <Search className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
            <p className="font-medium">{t('results.noResults')}</p>
            <p className="text-sm mt-1">
              {t('results.tryDifferent')}
            </p>
          </div>
        ) : null}
      </div>
    </AdaptiveLayout>
  );
}

