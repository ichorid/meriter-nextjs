'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, X } from 'lucide-react';
import { BrandButton } from './BrandButton';
import { BottomActionSheet } from './BottomActionSheet';
import { BrandInput } from './BrandInput';
import { useTranslations } from 'next-intl';

interface PageHeaderProps {
    title: string;
    showBack?: boolean;
    onBack?: () => void;
    rightAction?: React.ReactNode;
    className?: string;
    showSearch?: boolean;
    onSearch?: (query: string) => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    showBack = true,
    onBack,
    rightAction,
    className = '',
    showSearch = false,
    onSearch,
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

    const handleSearch = (value: string) => {
        setSearchQuery(value);
        if (onSearch) {
            onSearch(value);
        } else {
            // Default: navigate to search page
            if (value.trim()) {
                router.push(`/meriter/search?q=${encodeURIComponent(value.trim())}`);
            }
        }
    };

    const handleSearchClear = () => {
        setSearchQuery('');
        if (onSearch) {
            onSearch('');
        }
    };

    return (
        <>
            <div
                className={`
          sticky top-0 z-20 w-full bg-brand-surface/80 dark:bg-base-100 backdrop-blur-md border-b border-brand-secondary/10 dark:border-base-300/50
          flex items-center justify-between px-4 h-14
          ${className}
        `}
            >
                <div className="flex items-center flex-1 min-w-0">
                    {showBack && (
                        <BrandButton
                            variant="ghost"
                            size="sm"
                            className="mr-2 -ml-2 px-2 dark:text-base-content"
                            onClick={handleBack}
                            aria-label="Go back"
                        >
                            <ArrowLeft size={20} className="dark:text-base-content" />
                        </BrandButton>
                    )}
                    <h1 className="text-lg font-bold text-brand-text-primary dark:text-base-content truncate">
                        {title}
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {showSearch && (
                        <BrandButton
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            onClick={() => setShowSearchModal(true)}
                            aria-label={t('search') || 'Search'}
                        >
                            <Search size={18} />
                        </BrandButton>
                    )}

                    {rightAction && (
                        <div className="flex-shrink-0">
                            {rightAction}
                        </div>
                    )}
                </div>
            </div>

            {/* Search Modal Portal */}
            {showSearch && (
                <BottomActionSheet
                    isOpen={showSearchModal}
                    onClose={() => setShowSearchModal(false)}
                    title={t('search') || 'Search'}
                >
                    <div className="space-y-4">
                        <BrandInput
                            type="text"
                            placeholder={t('searchPlaceholder') || 'Search...'}
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            leftIcon={<Search size={18} />}
                            rightIcon={searchQuery ? (
                                <button
                                    type="button"
                                    onClick={handleSearchClear}
                                    className="text-brand-text-muted hover:text-brand-text-primary transition-colors"
                                    aria-label="Clear search"
                                >
                                    <X size={18} />
                                </button>
                            ) : undefined}
                            className="w-full"
                        />
                    </div>
                </BottomActionSheet>
            )}
        </>
    );
};
