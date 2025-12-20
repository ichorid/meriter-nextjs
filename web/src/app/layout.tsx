import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { headers } from 'next/headers';
import { detectBrowserLanguage, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/i18n/request';
import { cookies } from 'next/headers';
import { Root } from '@/components/Root';
import { QueryProvider } from '@/providers/QueryProvider';
import { GluestackUIProvider } from '@/providers/GluestackUIProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthWrapper } from '@/components/AuthWrapper';
import { ToastContainer } from '@/shared/components/toast-container';
import { AppModeProvider } from '@/contexts/AppModeContext';
import StyledJsxRegistry from '@/registry';

import { getEnabledProviders, getAuthEnv } from '@/lib/utils/oauth-providers';

export const metadata: Metadata = {
    title: 'Meriter',
    description: 'Merit-based community platform',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1.0,
    maximumScale: 1.0,
    userScalable: false,
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

    const env = getAuthEnv();
    const enabledProviders = getEnabledProviders(env);
    const authnEnabled = process.env.AUTHN_ENABLED === 'true';

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
                    <GluestackUIProvider>
                        <AppModeProvider>
                            <QueryProvider>
                                <NextIntlClientProvider messages={messages}>
                                    <AuthProvider>
                                        {/* Temporarily disable AuthWrapper for debugging - set DISABLE_AUTH_WRAPPER = true in AuthWrapper.tsx */}
                                        <AuthWrapper enabledProviders={enabledProviders} authnEnabled={authnEnabled}>
                                            <Root>{children}</Root>
                                        </AuthWrapper>
                                        <ToastContainer />
                                    </AuthProvider>
                                </NextIntlClientProvider>
                            </QueryProvider>
                        </AppModeProvider>
                    </GluestackUIProvider>
                </StyledJsxRegistry>
            </body>
        </html>
    );
}