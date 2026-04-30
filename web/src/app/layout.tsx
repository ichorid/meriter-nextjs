import type { Viewport } from 'next';
import './globals.css';
import { detectBrowserLanguage, type Locale } from '@/i18n/locale';
import ClientRootLayout from './ClientRootLayout';
import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';

export const metadata: Metadata = {
  title: {
    template: 'Meriter / %s',
    default: 'Meriter',
  },
  description: 'Meriter - Community Governance Platform',
  manifest: '/site.webmanifest',
  icons: {
    icon: [{ url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Meriter',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: '#0f172a',
};

async function resolveServerLocale(): Promise<Locale> {
  // Pilot deploy on cw.ru must be RU-only, regardless of cookie or browser language.
  const host = (await headers()).get('host') ?? '';
  const isPilotHost = host === 'cw.ru' || host.endsWith('.cw.ru');
  if (
    process.env.NEXT_PUBLIC_PILOT_STANDALONE === 'true' ||
    process.env.NEXT_PUBLIC_PILOT_MODE === 'true' ||
    isPilotHost
  ) {
    return 'ru';
  }

  const cookieVal = (await cookies()).get('NEXT_LOCALE')?.value;
  if (cookieVal === 'ru' || cookieVal === 'en') return cookieVal;

  const acceptLang = (await headers()).get('accept-language') ?? undefined;
  return detectBrowserLanguage(acceptLang);
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveServerLocale();

  return (
    <html lang={locale} translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    // Pilot on cw.ru must be dark and consistent across browsers.
    if (location.hostname === 'cw.ru' || location.hostname.endsWith('.cw.ru')) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      return;
    }

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
// Global chunk loading error handler
(function() {
  // Handle script loading errors (chunk load failures)
  window.addEventListener('error', function(event) {
    const target = event.target;
    const isChunkError = target && (
      (target.tagName === 'SCRIPT' && target.src) ||
      (target.tagName === 'LINK' && target.href && target.rel === 'preload')
    );
    
    if (isChunkError) {
      const src = target.src || target.href;
      const isNextChunk = src && (
        src.includes('/_next/static/chunks/') ||
        src.includes('/_next/static/css/')
      );
      
      if (isNextChunk) {
        console.error('ChunkLoadError: Failed to load', src);
        // Prevent default error handling
        event.preventDefault();
        
        // Retry by reloading the page after a short delay
        // This helps recover from stale chunk references after deployments
        const retryCount = parseInt(sessionStorage.getItem('chunkRetryCount') || '0', 10);
        if (retryCount < 2) {
          sessionStorage.setItem('chunkRetryCount', String(retryCount + 1));
          setTimeout(function() {
            window.location.reload();
          }, 1000);
        } else {
          // Too many retries, clear counter and show error
          sessionStorage.removeItem('chunkRetryCount');
          console.error('ChunkLoadError: Max retries reached. Please refresh manually.');
        }
      }
    }
  }, true); // Use capture phase to catch errors early
  
  // Handle unhandled promise rejections from chunk loading
  window.addEventListener('unhandledrejection', function(event) {
    const error = event.reason;
    if (error && (
      error.message && (
        error.message.includes('Failed to load chunk') ||
        error.message.includes('Loading chunk') ||
        error.message.includes('ChunkLoadError')
      ) ||
      error.name === 'ChunkLoadError'
    )) {
      console.error('ChunkLoadError (unhandled rejection):', error);
      event.preventDefault();
      
      const retryCount = parseInt(sessionStorage.getItem('chunkRetryCount') || '0', 10);
      if (retryCount < 2) {
        sessionStorage.setItem('chunkRetryCount', String(retryCount + 1));
        setTimeout(function() {
          window.location.reload();
        }, 1000);
      } else {
        sessionStorage.removeItem('chunkRetryCount');
        console.error('ChunkLoadError: Max retries reached. Please refresh manually.');
      }
    }
  });
})();
                        `,
          }}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ClientRootLayout serverLocale={locale}>{children}</ClientRootLayout>
      </body>
    </html>
  );
}
