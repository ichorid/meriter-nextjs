'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from './shadcn/button';
import { InlineSearchField } from './InlineSearchField';
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
    const [searchQuery, setSearchQuery] = useState('');

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    const handleSearchInput = (value: string) => {
        setSearchQuery(value);
        onSearch?.(value);
    };

    const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key !== 'Enter' || onSearch) {
            return;
        }
        const v = searchQuery.trim();
        if (v) {
            router.push(`/meriter/search?q=${encodeURIComponent(v)}`);
        }
    };

    const headerShell = asStickyHeader
        ? cn(
              'bg-base-100/95 backdrop-blur-md border-b border-base-200 -mx-4 w-[calc(100%+2rem)] flex-shrink-0 px-4 py-2',
              className,
          )
        : cn(
              'sticky top-0 z-20 w-full flex-shrink-0 border-b border-base-200 bg-base-100/95 px-4 py-2 backdrop-blur-md',
              className,
          );

    return (
        <header className={cn(headerShell, 'flex flex-col gap-2')}>
            <div className="flex min-h-10 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center">
                    {showBack && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 mr-2 rounded-xl px-2 active:scale-[0.98]"
                            onClick={handleBack}
                            aria-label={t('goBack')}
                        >
                            <ArrowLeft size={20} className="text-base-content" />
                        </Button>
                    )}
                    <h1 className="truncate text-lg font-semibold text-base-content">{title}</h1>
                </div>

                {rightAction ? <div className="shrink-0">{rightAction}</div> : null}
            </div>

            {showSearch ? (
                <div className="min-w-0 w-full max-w-2xl">
                    <InlineSearchField
                        value={searchQuery}
                        onChange={handleSearchInput}
                        onKeyDown={handleSearchKeyDown}
                        placeholder={t('searchPlaceholder')}
                        aria-label={t('search')}
                        clearAriaLabel={t('clearSearch')}
                    />
                </div>
            ) : null}
        </header>
    );
};
