'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useMemo } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { Label } from '@/components/ui/shadcn/label';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { cn } from '@/lib/utils';

export function LanguageSelector() {
    const t = useTranslations('settings');
    const [selectedValue, setSelectedValue] = useState('auto');

    useEffect(() => {
        // Get the stored preference or default to 'auto'
        const stored = localStorage.getItem('language') || 'auto';
        setSelectedValue(stored);
    }, []);

    const changeLanguage = async (value: string) => {
        setSelectedValue(value);
        localStorage.setItem('language', value);

        try {
            // Set cookie directly
            // Use secure flag when on HTTPS (required for cross-site cookies, good practice for HTTPS)
            const isSecure = window.location.protocol === 'https:';
            const secureFlag = isSecure ? '; secure' : '';
            document.cookie = `NEXT_LOCALE=${value}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax${secureFlag}`;

            // Reload page to get server-side rendering with new language
            window.location.reload();
        } catch (error) {
            console.error('Failed to set locale:', error);
        }
    };

    const options = useMemo(() => [
        { label: t('languageAuto'), value: 'auto' },
        { label: t('languageEnglish'), value: 'en' },
        { label: t('languageRussian'), value: 'ru' },
    ], [t]);

    return (
        <BrandFormControl label={t('language')}>
            <Select value={selectedValue} onValueChange={changeLanguage}>
                <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                    <SelectValue placeholder={t('languageAuto')} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </BrandFormControl>
    );
}
