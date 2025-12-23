'use client';

import type { Viewport } from 'next';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useState } from 'react';
import { detectBrowserLanguage, SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '@/i18n/request';
import { Root } from '@/components/Root';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { RuntimeConfigProvider } from '@/components/RuntimeConfigProvider';
import { ToastContainer } from '@/shared/components/toast-container';
import { AppModeProvider } from '@/contexts/AppModeContext';
import StyledJsxRegistry from '@/registry';
import { getEnabledProviders, getAuthEnv } from '@/lib/utils/oauth-providers';
import { ClientRouter } from '@/components/ClientRouter';

// Import translation messages
import enMessages from '../../messages/en.json';
import ruMessages from '../../messages/ru.json';

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1.0,
    maximumScale: 1.0,
    userScalable: false,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
    const [messages, setMessages] = useState(enMessages);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Client-side locale detection
        const detectLocale = (): Locale => {
            // 1. Check cookie first
            const cookieLocale = document.cookie
                .split('; ')
                .find(row => row.startsWith('NEXT_LOCALE='))
                ?.split('=')[1];

            if (cookieLocale === 'ru' || cookieLocale === 'en') {
                return cookieLocale;
            }

            // 2. Check localStorage (for 'auto' preference)
            const stored = localStorage.getItem('language');
            if (stored === 'ru' || stored === 'en') {
                return stored;
            }

            // 3. Detect from browser
            const browserLang = navigator.language?.split('-')[0]?.toLowerCase() || 'en';
            return browserLang === 'ru' ? 'ru' : 'en';
        };

        const detectedLocale = detectLocale();
        setLocale(detectedLocale);
        setMessages(detectedLocale === 'ru' ? ruMessages : enMessages);
        
        // Set HTML lang attribute
        document.documentElement.lang = detectedLocale;
        
        // Set cookie if not present
        if (!document.cookie.includes('NEXT_LOCALE=')) {
            const browserLang = navigator.language?.split('-')[0]?.toLowerCase() || 'en';
            const defaultLocale = browserLang === 'ru' ? 'ru' : 'en';
            document.cookie = `NEXT_LOCALE=${defaultLocale}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax`;
        }
        
        setMounted(true);
    }, []);

    // Use build-time defaults as fallback (RuntimeConfigProvider will override with runtime config)
    const env = getAuthEnv();
    const enabledProviders = getEnabledProviders(env);
    const authnEnabled = (process.env.NEXT_PUBLIC_AUTHN_ENABLED || process.env.AUTHN_ENABLED) === 'true';

    // Prevent hydration mismatch - render with default locale first
    if (!mounted) {
        return (
            <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
                <head>
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `
(function() {
  try {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let theme = 'light';
    
    if (stored === 'dark' || stored === 'light') {
      theme = stored;
    } else if (stored === 'auto' || !stored) {
      theme = prefersDark ? 'dark' : 'light';
    }
    
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // localStorage not available, use default
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
                        `,
                        }}
                    />
                    <link
                        href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap"
                        rel="stylesheet"
                    />
                    <link
                        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
                        rel="stylesheet"
                    />
                </head>
                <body suppressHydrationWarning>
                    <div>Loading...</div>
                </body>
            </html>
        );
    }

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
(function() {
  try {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let theme = 'light';
    
    if (stored === 'dark' || stored === 'light') {
      theme = stored;
    } else if (stored === 'auto' || !stored) {
      theme = prefersDark ? 'dark' : 'light';
    }
    
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // localStorage not available, use default
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
                        `,
                    }}
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap"
                    rel="stylesheet"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
                    rel="stylesheet"
                />
            </head>
            <body suppressHydrationWarning>
                <StyledJsxRegistry>
                    <AppModeProvider>
                        <QueryProvider>
                            <NextIntlClientProvider locale={locale} messages={messages}>
                                <ClientRouter />
                                <AuthProvider>
                                    {/* RuntimeConfigProvider fetches config from API and passes to AuthWrapper */}
                                    <RuntimeConfigProvider 
                                        fallbackEnabledProviders={enabledProviders}
                                        fallbackAuthnEnabled={authnEnabled}
                                    >
                                        <Root>{children}</Root>
                                    </RuntimeConfigProvider>
                                    <ToastContainer />
                                </AuthProvider>
                            </NextIntlClientProvider>
                        </QueryProvider>
                    </AppModeProvider>
                </StyledJsxRegistry>
            </body>
        </html>
    );
}
