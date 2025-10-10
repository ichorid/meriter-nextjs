import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@shared/lib/theme-provider';

export const metadata: Metadata = {
    title: 'Meriter',
    description: 'Merit-based community platform',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ru" suppressHydrationWarning>
            <head>
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
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    );
}

