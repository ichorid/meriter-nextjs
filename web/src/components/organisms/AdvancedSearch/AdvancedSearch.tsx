'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, X, Filter, Calendar, _User, Hash, _Users } from 'lucide-react';
import { Input } from '@/components/ui/shadcn/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import type { SearchContentType } from '@/types/api-v1';

interface AdvancedSearchProps {
  onSearch?: (params: SearchParams) => void;
  initialQuery?: string;
  className?: string;
}

export interface SearchParams {
  query?: string;
  contentType?: SearchContentType;
  tags?: string[];
  authorId?: string;
  communityId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const CONTENT_TYPES: Array<{ value: SearchContentType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'publications', label: 'Publications' },
  { value: 'comments', label: 'Comments' },
  { value: 'polls', label: 'Polls' },
  { value: 'communities', label: 'Communities' },
];

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  initialQuery = '',
  className = '',
}) => {
  const router = useRouter();
  const t = useTranslations('search');
  const tCommon = useTranslations('common');
  const [query, setQuery] = useState(initialQuery);
  const [contentType, setContentType] = useState<SearchContentType>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('meriter_search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch {
        console.warn('Failed to load search history:', e);
      }
    }
  }, []);

  // Save search history
  const saveToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const updated = [
      searchQuery,
      ...searchHistory.filter((item) => item !== searchQuery),
    ].slice(0, 10); // Keep last 10 searches
    
    setSearchHistory(updated);
    localStorage.setItem('meriter_search_history', JSON.stringify(updated));
  };

  // Handle search
  const handleSearch = () => {
    if (!query.trim() && !tags.length && !dateFrom && !dateTo) {
      return;
    }

    const params: SearchParams = {
      query: query.trim() || undefined,
      contentType: contentType !== 'all' ? contentType : undefined,
      tags: tags.length > 0 ? tags : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };

    saveToHistory(query.trim());
    setShowHistory(false);

    if (onSearch) {
      onSearch(params);
    } else {
      // Navigate to search results page
      const searchParams = new URLSearchParams();
      if (params.query) searchParams.set('q', params.query);
      if (params.contentType) searchParams.set('type', params.contentType);
      if (params.tags?.length) searchParams.set('tags', params.tags.join(','));
      if (params.dateFrom) searchParams.set('from', params.dateFrom);
      if (params.dateTo) searchParams.set('to', params.dateTo);
      
      router.push(`/meriter/search?${searchParams.toString()}`);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowHistory(false);
    }
  };

  // Add tag
  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  // Select from history
  const handleHistorySelect = (historyItem: string) => {
    setQuery(historyItem);
    setShowHistory(false);
    const input = searchInputRef.current?.querySelector('input');
    input?.focus();
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setTags([]);
    setDateFrom('');
    setDateTo('');
    setContentType('all');
    const input = searchInputRef.current?.querySelector('input');
    input?.focus();
  };

  // Click outside to close history
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        historyRef.current &&
        !historyRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Input */}
      <div className="relative" ref={searchInputRef}>
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowHistory(e.target.value.length > 0 || searchHistory.length > 0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (searchHistory.length > 0) {
              setShowHistory(true);
            }
          }}
          placeholder={t('results.searchPlaceholder')}
          className={cn('h-11 rounded-xl pl-10 w-full', query && 'pr-10')}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-base-200 rounded-full transition-colors z-10"
            aria-label={tCommon('clear')}
          >
            <X size={16} />
          </button>
        )}

        {/* Search History Dropdown */}
        {showHistory && searchHistory.length > 0 && (
          <div
            ref={historyRef}
            className="absolute z-50 w-full mt-2 bg-base-100 border border-base-300 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            {searchHistory.map((item, index) => (
              <button
                key={index}
                onClick={() => handleHistorySelect(item)}
                className="w-full px-4 py-2 text-left hover:bg-base-200 transition-colors flex items-center gap-2"
              >
                <Search size={16} className="text-base-content/60" />
                <span className="text-sm text-base-content">{item}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-brand-text-secondary hover:text-brand-primary transition-colors"
        >
          <Filter size={16} />
          <span>{t('filters')}</span>
        </button>

        <Button
          onClick={handleSearch}
          disabled={!query.trim() && !tags.length && !dateFrom && !dateTo}
          className="rounded-xl active:scale-[0.98] w-fit"
        >
          {t('search')}
        </Button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="space-y-4 p-4 bg-base-200 rounded-xl border border-base-300">
          {/* Content Type */}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary mb-2">
              {t('contentType')}
            </label>
            <Select
              value={contentType}
              onValueChange={(value) => setContentType(value as SearchContentType)}
            >
              <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(`contentTypes.${type.value}`) || type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-brand-text-primary mb-2">
              {t('tags')}
            </label>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder={t('tagsPlaceholder')}
                  className="h-11 rounded-xl pl-10"
                />
              </div>
              <Button onClick={handleAddTag} className="rounded-xl active:scale-[0.98] w-fit">
                {t('add')}
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-brand-primary/10 text-brand-primary rounded-lg text-sm"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:bg-brand-primary/20 rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-text-primary mb-2">
                {t('dateFrom')}
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-11 rounded-xl pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary mb-2">
                {t('dateTo')}
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-11 rounded-xl pl-10"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
