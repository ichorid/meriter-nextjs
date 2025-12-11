'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, X } from 'lucide-react';
import { BrandButton } from './BrandButton';
import { BottomActionSheet } from './BottomActionSheet';
import { BrandInput } from './BrandInput';
import { useTranslations } from 'next-intl';

interface PageHeaderProps {
    title: React.ReactNode;
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
            <header
                className={`
                    sticky top-0 z-20 bg-base-100/95 backdrop-blur-md border-b border-base-content/10
                    flex items-center justify-between px-4 h-14 flex-shrink-0 w-full
                    ${className}
                `}
            >
                <div className="flex items-center flex-1 min-w-0">
                    {showBack && (
                        <BrandButton
                            variant="ghost"
                            size="sm"
                            className="mr-2 -ml-2 px-2"
                            onClick={handleBack}
                            aria-label={t('goBack')}
                        >
                            <ArrowLeft size={20} className="text-base-content" />
                        </BrandButton>
                    )}
                    <h1 className="text-lg font-semibold text-base-content truncate">
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
                            <Search size={18} className="text-base-content/70" />
                        </BrandButton>
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
                                    aria-label={t('clearSearch')}
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
