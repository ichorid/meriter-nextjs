/**
 * Unit tests for captive (in-app) browser detection
 */

import { isCaptiveBrowser } from '../captive-browser';

describe('isCaptiveBrowser', () => {
  const originalNavigator = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  afterEach(() => {
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    }
    if (typeof window !== 'undefined') {
      if ('Telegram' in window) {
        delete (window as unknown as { Telegram?: unknown }).Telegram;
      }
      if ('TelegramWebview' in window) {
        delete (window as unknown as { TelegramWebview?: unknown }).TelegramWebview;
      }
      if ('TelegramWebviewProxy' in window) {
        delete (window as unknown as { TelegramWebviewProxy?: unknown }).TelegramWebviewProxy;
      }
      if ('TelegramWebviewProxyProto' in window) {
        delete (window as unknown as { TelegramWebviewProxyProto?: unknown }).TelegramWebviewProxyProto;
      }
    }
  });

  it('returns true when window.Telegram.WebApp is present', () => {
    (window as unknown as { Telegram?: { WebApp: unknown } }).Telegram = { WebApp: {} };
    expect(isCaptiveBrowser()).toBe(true);
  });

  it('returns true when user agent contains known in-app pattern (FBAN)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10) FBAN/Instagram',
      configurable: true,
      writable: true,
    });
    expect(isCaptiveBrowser()).toBe(true);
  });

  it('returns true when user agent contains Instagram', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Instagram 123.0',
      configurable: true,
      writable: true,
    });
    expect(isCaptiveBrowser()).toBe(true);
  });

  it('returns false for normal desktop Chrome user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
      writable: true,
    });
    expect(isCaptiveBrowser()).toBe(false);
  });

  it('returns false for normal mobile Safari user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
      writable: true,
    });
    expect(isCaptiveBrowser()).toBe(false);
  });

  it('returns true when window.TelegramWebview is present (Android)', () => {
    (window as unknown as { TelegramWebview?: { postEvent?: unknown } }).TelegramWebview = { postEvent: () => {} };
    expect(isCaptiveBrowser()).toBe(true);
  });

  it('returns true when window.TelegramWebviewProxy is present (iOS/Desktop)', () => {
    (window as unknown as { TelegramWebviewProxy?: { postEvent?: unknown } }).TelegramWebviewProxy = { postEvent: () => {} };
    expect(isCaptiveBrowser()).toBe(true);
  });

  it('returns true when user agent contains Telegram-Android', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120.0 Telegram-Android/10.0',
      configurable: true,
      writable: true,
    });
    expect(isCaptiveBrowser()).toBe(true);
  });

  it('returns true when user agent contains TDesktop', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TDesktop/4.0',
      configurable: true,
      writable: true,
    });
    expect(isCaptiveBrowser()).toBe(true);
  });
});
