import type { Viewport } from 'next';
import './globals.css';
import { DEFAULT_LOCALE } from '@/i18n/request';
import ClientRootLayout from './ClientRootLayout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: 'Meriter / %s',
    default: 'Meriter',
  },
  description: 'Meriter - Community Governance Platform',
};

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
