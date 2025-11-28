'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';

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
            document.cookie = `NEXT_LOCALE=${value}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax`;

            // Reload page to get server-side rendering with new language
            window.location.reload();
        } catch (error) {
            console.error('Failed to set locale:', error);
        }
    };

    return (
        <BrandFormControl label={t('language')}>
            <BrandSelect
                value={selectedValue}
                onChange={changeLanguage}
                options={[
                    { label: t('languageAuto'), value: 'auto' },
                    { label: 'English', value: 'en' },
                    { label: 'Русский', value: 'ru' },
                ]}
                placeholder={t('languageAuto')}
                fullWidth
            />
        </BrandFormControl>
    );
}
