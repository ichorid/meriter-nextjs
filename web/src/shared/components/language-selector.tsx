'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

export function LanguageSelector() {
    const t = useTranslations('settings');
    const locale = useLocale();
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
        <div className="form-control w-full max-w-xs">
            <label className="label">
                <span className="label-text font-medium">{t('language')}</span>
            </label>
            <select
                className="select select-bordered w-full"
                value={selectedValue}
                onChange={(e) => changeLanguage(e.target.value)}
            >
                <option value="auto">{t('languageAuto')}</option>
                <option value="en">English</option>
                <option value="ru">Русский</option>
            </select>
            <label className="label">
                <span className="label-text-alt text-base-content/60">
                    {t('languageDescription')}
                </span>
            </label>
        </div>
    );
}

