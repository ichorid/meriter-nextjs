'use client';

import { I18nextProvider } from 'react-i18next';
import { useEffect } from 'react';
import i18n from '../lib/i18n';
import { Locale, Translations } from '../lib/i18n-server';

interface I18nProviderProps {
    children: React.ReactNode;
    locale: Locale;
    initialTranslations: Translations;
}

export function I18nProvider({ children, locale, initialTranslations }: I18nProviderProps) {
    useEffect(() => {
        // Initialize i18n with server-provided translations
        i18n.changeLanguage(locale);
        
        // Add all translations synchronously
        Object.entries(initialTranslations).forEach(([namespace, translations]) => {
            i18n.addResourceBundle(locale, namespace, translations, true, true);
        });
    }, [locale, initialTranslations]);

    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

