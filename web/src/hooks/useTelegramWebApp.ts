/**
 * Stub file for useTelegramWebApp hook
 * This file exists to satisfy Jest module resolution for tests
 */

export function useTelegramWebApp() {
  return {
    isInTelegram: false,
    initData: null,
    user: null,
    colorScheme: 'light' as const,
    themeParams: {},
    version: '1.0',
    platform: 'web' as const,
    ready: true,
  };
}
