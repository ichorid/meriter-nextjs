'use client';

import { useEffect, useRef } from 'react';
import { useCaptiveBrowser } from '@/lib/captive-browser';

/**
 * TelegramHint Component
 *
 * Conditionally loads tg-hint when running in Telegram in-app browser.
 * isCaptive comes from CaptiveBrowserContext so tg-hint and the sign-in screen
 * share the same captive state (single source of truth).
 *
 * Note: tg-hint auto-detects language from navigator.language, so it may differ
 * slightly from the app's user preference. This is acceptable as tg-hint is a
 * one-time helper overlay.
 */
export function TelegramHint() {
  const { isCaptive } = useCaptiveBrowser();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !isCaptive) {
      return;
    }

    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const initTgHint = () => {
      if (document.getElementById('tg-hint-script')) {
        return;
      }

      const script = document.createElement('script');
      script.id = 'tg-hint-script';
      script.src = '/tg-hint.min.js';
      script.async = true;
      script.onerror = () => {
        console.warn('Failed to load tg-hint script');
      };
      document.head.appendChild(script);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initTgHint);
      return () => {
        document.removeEventListener('DOMContentLoaded', initTgHint);
      };
    }
    initTgHint();
  }, [isCaptive]);

  // This component doesn't render anything - tg-hint handles its own UI
  return null;
}
