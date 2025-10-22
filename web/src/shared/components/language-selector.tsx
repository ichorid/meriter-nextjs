'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

export function LanguageSelector() {
    const { i18n, t } = useTranslation('settings');
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
            // Set cookie via API
            await fetch('/api/set-locale', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ locale: value }),
            });
            
            // Change language immediately for instant feedback
            if (value === 'auto') {
                // Detect browser language
                const browserLang = navigator.language.split('-')[0];
                const detectedLang = browserLang === 'ru' ? 'ru' : 'en';
                i18n.changeLanguage(detectedLang);
            } else {
                i18n.changeLanguage(value);
            }
            
            // Reload page to get server-side rendering with new language
            window.location.reload();
        } catch (error) {
            console.error('Failed to set locale:', error);
            // Fallback to client-side only change
            if (value === 'auto') {
                const browserLang = navigator.language.split('-')[0];
                const detectedLang = browserLang === 'ru' ? 'ru' : 'en';
                i18n.changeLanguage(detectedLang);
            } else {
                i18n.changeLanguage(value);
            }
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

