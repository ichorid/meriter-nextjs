import React from 'react';

/**
 * Captive (in-app) browser detection for login UX.
 * When true, we show only SMS and Email auth and prompt the user to open in system browser.
 *
 * Detection:
 * - Telegram: window.Telegram?.WebApp (Mini App), window.TelegramWebview (Android), window.TelegramWebviewProxy (iOS/Desktop)
 * - Other in-app browsers: User-Agent substrings (FBAN, FBAV, Instagram, Line, etc.)
 */

/** User-Agent substrings for known in-app WebViews. Extend as needed. */
const CAPTIVE_UA_PATTERNS = [
  'FBAN', // Facebook in-app
  'FBAV',
  'Instagram',
  'Line',
  'MicroMessenger', // WeChat
  'KAKAOTALK',
  'Snapchat',
  'Twitter',
  'LinkedInApp',
];

declare global {
  interface Window {
    Telegram?: {
      WebApp?: unknown;
    };
    TelegramWebview?: { postEvent?: unknown };
    TelegramWebviewProxy?: { postEvent?: unknown };
    TelegramWebviewProxyProto?: unknown;
  }
}

/**
 * Returns true when running inside a captive/in-app browser (e.g. Telegram, Facebook).
 * Safe for SSR: returns false when window is undefined.
 */
export function isCaptiveBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Telegram: Mini App SDK, Android WebView, iOS/Desktop WebView
  if (
    window.Telegram?.WebApp ||
    window.TelegramWebview ||
    window.TelegramWebviewProxy
  ) {
    return true;
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  // Telegram UA fallback (Desktop client, web client)
  if (/(Telegram-Android|Telegram\/|TDesktop|TWeb)/i.test(ua)) {
    return true;
  }

  // Other known in-app browsers
  return CAPTIVE_UA_PATTERNS.some((pattern) => ua.includes(pattern));
}

/**
 * Hook that returns captive state after mount (client-side only).
 * Before hydration / on server, returns false to avoid flash of wrong UI.
 */
export function useCaptiveBrowser(): {
  isCaptive: boolean;
  copyLink: () => Promise<void>;
  openInBrowser: () => void;
} {
  const [isCaptive, setIsCaptive] = React.useState(false);

  React.useEffect(() => {
    setIsCaptive(isCaptiveBrowser());
  }, []);

  const copyLink = React.useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }, []);

  const openInBrowser = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    window.open(window.location.href, '_blank');
  }, []);

  return { isCaptive, copyLink, openInBrowser };
}
