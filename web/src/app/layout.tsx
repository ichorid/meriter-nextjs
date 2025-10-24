import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@shared/lib/theme-provider';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { headers } from 'next/headers';
import { detectBrowserLanguage, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/i18n/request';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
    title: 'Meriter',
    description: 'Merit-based community platform',
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Get server-side locale and messages
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    
    // Get locale from cookie with fallback to browser detection
    const cookieStore = await cookies();
    const localePreference = cookieStore.get('NEXT_LOCALE')?.value;
    
    let locale = DEFAULT_LOCALE;
    if (localePreference === 'auto') {
        locale = detectBrowserLanguage(acceptLanguage || undefined);
    } else if (localePreference && SUPPORTED_LOCALES.includes(localePreference as any)) {
        locale = localePreference as any;
    } else {
        locale = detectBrowserLanguage(acceptLanguage || undefined);
    }
    
    const messages = await getMessages({ locale });
    
    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <script src="https://telegram.org/js/telegram-web-app.js"></script>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    // Check if we're in Telegram Web App
                                    const tg = window.Telegram?.WebApp;
                                    let resolvedTheme = 'light';
                                    
                                    if (tg && tg.initData) {
                                        // We're in Telegram Web App
                                        console.log('🎨 Server-side: Telegram Web App detected');
                                        if (tg.colorScheme) {
                                            resolvedTheme = tg.colorScheme === 'dark' ? 'dark' : 'light';
                                            console.log('🎨 Server-side: Using Telegram theme:', resolvedTheme);
                                        }
                                    } else {
                                        // Not in Telegram, use localStorage or system preference
                                        // Check if localStorage is available (client-side only)
                                        if (typeof localStorage !== 'undefined') {
                                            const theme = localStorage.getItem('theme') || 'auto';
                                            if (theme === 'auto') {
                                                resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                                            } else {
                                                resolvedTheme = theme;
                                            }
                                            console.log('🎨 Server-side: Using stored/system theme:', resolvedTheme);
                                        } else {
                                            // Server-side fallback to system preference
                                            resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                                            console.log('🎨 Server-side: Using system theme (localStorage not available):', resolvedTheme);
                                        }
                                    }
                                    
                                    document.documentElement.setAttribute('data-theme', resolvedTheme);
                                } catch (e) {
                                    console.error('🎨 Server-side theme initialization error:', e);
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
                <NextIntlClientProvider messages={messages}>
                    <ThemeProvider>{children}</ThemeProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}

