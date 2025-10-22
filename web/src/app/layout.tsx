import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@shared/lib/theme-provider';
import { I18nProvider } from '@/providers/i18n-provider';
import { getServerTranslations } from '@/lib/i18n-server';
import { headers } from 'next/headers';

export const metadata: Metadata = {
    title: 'Meriter',
    description: 'Merit-based community platform',
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Get server-side translations
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    const { locale, translations } = await getServerTranslations(acceptLanguage || undefined);
    
    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <script src="https://telegram.org/js/telegram-web-app.js"></script>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    const theme = localStorage.getItem('theme') || 'auto';
                                    let resolvedTheme = theme;
                                    if (theme === 'auto') {
                                        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                                    }
                                    document.documentElement.setAttribute('data-theme', resolvedTheme);
                                } catch (e) {}
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
                <I18nProvider locale={locale} initialTranslations={translations}>
                    <ThemeProvider>{children}</ThemeProvider>
                </I18nProvider>
            </body>
        </html>
    );
}

