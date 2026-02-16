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

  // Telegram UA fallback (Android in-app, Desktop client, web client)
  if (/(TelegramAndroid|Telegram-Android|Telegram\/|TDesktop|TWeb)/i.test(ua)) {
    return true;
  }

  // Other known in-app browsers
  return CAPTIVE_UA_PATTERNS.some((pattern) => ua.includes(pattern));
}

/** Default so consumers outside the provider (e.g. tests) get a safe value. */
const CaptiveBrowserContext = React.createContext<{ isCaptive: boolean }>({
  isCaptive: false,
});

/**
 * Delayed re-check schedule (ms). Telegram injects TelegramWebview asynchronously;
 * the login page can run detection before it exists. Re-checking at these intervals
 * catches late-injected TelegramWebview so the sign-in screen and tg-hint stay in sync.
 */
const RECHECK_DELAYS_MS = [200, 500, 1000, 2000];

/**
 * Provider that runs captive detection with delayed re-checks so both
 * TelegramHint and the login form see the same value. Must wrap both
 * TelegramHint and the routed content (e.g. login page) so they stay in sync.
 *
 * - Initial isCaptive is false to avoid flicker in non-captive browsers.
 * - We only ever transition to true (never true -> false), so React bails out
 *   on identical state in non-captive browsers and no unnecessary re-renders.
 */
export function CaptiveBrowserProvider({ children }: { children: React.ReactNode }) {
  const [isCaptive, setIsCaptive] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const runCheck = (): boolean => {
      const detected = isCaptiveBrowser();
      if (detected) {
        setIsCaptive(true);
        return true;
      }
      return false;
    };

    if (runCheck()) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    for (const delay of RECHECK_DELAYS_MS) {
      timeouts.push(
        setTimeout(() => {
          if (runCheck()) {
            timeouts.forEach(clearTimeout);
          }
        }, delay)
      );
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return React.createElement(CaptiveBrowserContext.Provider, { value: { isCaptive } }, children);
}

/**
 * Hook that returns captive state from context (when inside CaptiveBrowserProvider).
 * Before hydration / on server, or when outside the provider, returns false.
 * Only transitioning to true (never true -> false) avoids re-renders in non-captive browsers.
 */
export function useCaptiveBrowser(): {
  isCaptive: boolean;
  copyLink: () => Promise<void>;
  openInBrowser: () => void;
} {
  const { isCaptive } = React.useContext(CaptiveBrowserContext);

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
