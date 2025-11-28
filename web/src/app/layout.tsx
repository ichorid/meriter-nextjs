import type { Metadata } from 'next';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { headers } from 'next/headers';
import { detectBrowserLanguage, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/i18n/request';
import { cookies } from 'next/headers';
import { Root } from '@/components/Root';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthWrapper } from '@/components/AuthWrapper';
import { AppModeProvider } from '@/contexts/AppModeContext';
import StyledJsxRegistry from '@/registry';

import { getEnabledProviders } from '@/lib/utils/oauth-providers';

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

    // Get enabled providers from env (explicitly accessing process.env for Next.js)
    const env = {
        OAUTH_GOOGLE_ENABLED: process.env.OAUTH_GOOGLE_ENABLED,
        OAUTH_YANDEX_ENABLED: process.env.OAUTH_YANDEX_ENABLED,
        OAUTH_VK_ENABLED: process.env.OAUTH_VK_ENABLED,
        OAUTH_TELEGRAM_ENABLED: process.env.OAUTH_TELEGRAM_ENABLED,
        OAUTH_APPLE_ENABLED: process.env.OAUTH_APPLE_ENABLED,
        OAUTH_TWITTER_ENABLED: process.env.OAUTH_TWITTER_ENABLED,
        OAUTH_INSTAGRAM_ENABLED: process.env.OAUTH_INSTAGRAM_ENABLED,
        OAUTH_SBER_ENABLED: process.env.OAUTH_SBER_ENABLED,
    };
    const enabledProviders = getEnabledProviders(env);

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
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
                            <NextIntlClientProvider messages={messages}>
                                <AuthProvider>
                                    {/* Temporarily disable AuthWrapper for debugging - set DISABLE_AUTH_WRAPPER = true in AuthWrapper.tsx */}
                                    <AuthWrapper enabledProviders={enabledProviders}>
                                        <Root>{children}</Root>
                                    </AuthWrapper>
                                </AuthProvider>
                            </NextIntlClientProvider>
                        </QueryProvider>
                    </AppModeProvider>
                </StyledJsxRegistry>
            </body>
        </html>
    );
}