'use client';

import { useEffect, useRef } from 'react';
import { isCaptiveBrowser } from '@/lib/captive-browser';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/request';

/**
 * TelegramHint Component
 * 
 * Conditionally loads and initializes tg-hint package when running in Telegram in-app browser.
 * Syncs language with the app's locale detection system (en/ru).
 * 
 * Note: tg-hint auto-detects language from navigator.language, so it may differ
 * slightly from the app's user preference. This is acceptable as tg-hint is a
 * one-time helper overlay.
 */
export function TelegramHint() {
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only run client-side
    if (typeof window === 'undefined') {
      return;
    }

    // Only initialize once
    if (hasInitialized.current) {
      return;
    }

    // Only load if we're in a captive browser (Telegram)
    if (!isCaptiveBrowser()) {
      return;
    }

    // Mark as initialized to prevent multiple loads
    hasInitialized.current = true;

    // Detect locale using the same logic as detectLocale() in ClientRootLayout
    const detectLocale = (): Locale => {
      try {
        const cookieLocale = document.cookie
          .split('; ')
          .find(row => row.startsWith('NEXT_LOCALE='))
          ?.split('=')[1];

        if (cookieLocale === 'ru' || cookieLocale === 'en') {
          return cookieLocale;
        }

        const stored = localStorage.getItem('language');
        if (stored === 'ru' || stored === 'en') {
          return stored;
        }

        const browserLang = navigator.language?.split('-')[0]?.toLowerCase() || 'en';
        return browserLang === 'ru' ? 'ru' : 'en';
      } catch {
        return DEFAULT_LOCALE;
      }
    };

    // Wait for DOM to be ready
    const initTgHint = () => {
      // Load tg-hint as a script tag since it's a self-executing script
      // Check if already loaded
      if (document.getElementById('tg-hint-script')) {
        return;
      }

      const script = document.createElement('script');
      script.id = 'tg-hint-script';
      script.src = '/tg-hint.min.js';
      script.async = true;
      script.onerror = () => {
        // Silently fail if tg-hint fails to load
        console.warn('Failed to load tg-hint script');
      };
      document.head.appendChild(script);
    };

    // Initialize after a short delay to ensure DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initTgHint);
      return () => {
        document.removeEventListener('DOMContentLoaded', initTgHint);
      };
    } else {
      // DOM already ready
      initTgHint();
    }
  }, []);

  // This component doesn't render anything - tg-hint handles its own UI
  return null;
}
