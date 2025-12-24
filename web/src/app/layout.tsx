import type { Viewport } from 'next';
import './globals.css';
import { DEFAULT_LOCALE } from '@/i18n/request';
import ClientRootLayout from './ClientRootLayout';

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
  } catch {
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
                <ClientRootLayout>{children}</ClientRootLayout>
            </body>
        </html>
    );
}
