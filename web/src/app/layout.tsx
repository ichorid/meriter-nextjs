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
import { AppModeProvider } from '@/contexts/AppModeContext';

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
                <AppModeProvider>
                    <QueryProvider>
                        <AuthProvider>
                            <NextIntlClientProvider messages={messages}>
                                <Root>{children}</Root>
                            </NextIntlClientProvider>
                        </AuthProvider>
                    </QueryProvider>
                </AppModeProvider>
            </body>
        </html>
    );
}