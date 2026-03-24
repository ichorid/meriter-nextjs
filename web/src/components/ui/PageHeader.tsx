'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Button } from './shadcn/button';
import { BottomActionSheet } from './BottomActionSheet';
import { Input } from './shadcn/input';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface PageHeaderProps {
    title: React.ReactNode;
    showBack?: boolean;
    onBack?: () => void;
    rightAction?: React.ReactNode;
    className?: string;
    showSearch?: boolean;
    onSearch?: (query: string) => void;
    asStickyHeader?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    showBack = true,
    onBack,
    rightAction,
    className = '',
    showSearch = false,
    onSearch,
    asStickyHeader = false,
}) => {
    const router = useRouter();
    const t = useTranslations('common');
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    const applySearchFromModal = () => {
        const q = searchQuery.trim();
        if (onSearch) {
            onSearch(q);
        } else if (q) {
            router.push(`/meriter/search?q=${encodeURIComponent(q)}`);
        }
        setShowSearchModal(false);
    };

    const dismissSearchModal = () => {
        setShowSearchModal(false);
    };

    const handleSearchClear = () => {
        setSearchQuery('');
        if (onSearch) {
            onSearch('');
        }
    };

    const headerClasses = asStickyHeader
        ? `bg-base-100/95 backdrop-blur-md border-b border-base-200 px-4 py-2 flex items-center justify-between -mx-4 px-4 h-14 flex-shrink-0 w-[calc(100%+2rem)] ${className}`
        : `sticky top-0 z-20 bg-base-100/95 backdrop-blur-md border-b border-base-200 px-4 flex items-center justify-between px-4 h-14 flex-shrink-0 w-full ${className}`;

    return (
        <>
            <header
                className={headerClasses}
            >
                <div className="flex items-center flex-1 min-w-0">
                    {showBack && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl active:scale-[0.98] mr-2 -ml-2 px-2"
                            onClick={handleBack}
                            aria-label={t('goBack')}
                        >
                            <ArrowLeft size={20} className="text-base-content" />
                        </Button>
                    )}
                    <h1 className="text-lg font-semibold text-base-content truncate">
                        {title}
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {showSearch && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl active:scale-[0.98] px-2"
                            onClick={() => setShowSearchModal(true)}
                            aria-label={t('search')}
                        >
                            <Search size={18} className="text-base-content/70" />
                        </Button>
                    )}

                    {rightAction && (
                        <div className="flex-shrink-0">
                            {rightAction}
                        </div>
                    )}
                </div>
            </header>

            {/* Search Modal Portal */}
            {showSearch && (
                <BottomActionSheet
                    isOpen={showSearchModal}
                    onClose={dismissSearchModal}
                    title={t('search')}
                    footer={
                        <Button
                            type="submit"
                            form="page-header-search-form"
                            className="h-11 w-full rounded-xl text-base font-medium"
                            disabled={!onSearch && !searchQuery.trim()}
                        >
                            {t('find')}
                        </Button>
                    }
                >
                    <form
                        id="page-header-search-form"
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            applySearchFromModal();
                        }}
                    >
                        <div className="relative w-full">
                            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                enterKeyHint="search"
                                placeholder={t('searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={cn('h-11 w-full rounded-xl pl-10', searchQuery && 'pr-10')}
                                autoFocus
                            />
                            {searchQuery ? (
                                <button
                                    type="button"
                                    onClick={handleSearchClear}
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
        </>
    );
};
