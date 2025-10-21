'use client';

import { I18nextProvider } from 'react-i18next';
import { useEffect, useState } from 'react';
import i18n from '../lib/i18n';

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Load translations dynamically
        const loadTranslations = async () => {
            const locales = ['en', 'ru'];
            const namespaces = [
                'common',
                'home',
                'login',
                'wallet',
                'settings',
                'polls',
                'feed',
                'comments',
                'communities',
                'shared',
                'pages',
            ];

            for (const locale of locales) {
                for (const ns of namespaces) {
                    try {
                        const translations = await import(
                            `../../public/locales/${locale}/${ns}.json`
                        );
                        i18n.addResourceBundle(
                            locale,
                            ns,
                            translations.default
                        );
                    } catch (error) {
                        console.error(
                            `Failed to load translation: ${locale}/${ns}`,
                            error
                        );
                    }
                }
            }
            setIsReady(true);
        };

        loadTranslations();
    }, []);

    if (!isReady) return <>{children}</>; // Render with English fallback

    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

