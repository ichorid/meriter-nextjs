import { mockTelegramEnv, isTMA, emitEvent } from '@telegram-apps/sdk-react';

/**
 * Clear persisted Telegram SDK storage to prevent stale state after logout
 */
function clearTelegramSDKStorage(): void {
  try {
    // Clear localStorage keys used by Telegram SDK
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tma/') || key.includes('telegram') || key.includes('init-data'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🧹 Cleared Telegram SDK storage key:', key);
    });
    
    // Also clear sessionStorage
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('tma/') || key.includes('telegram') || key.includes('init-data'))) {
        sessionKeysToRemove.push(key);
      }
    }
    
    sessionKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
      console.log('🧹 Cleared Telegram SDK session storage key:', key);
    });
  } catch (error) {
    console.warn('⚠️ Failed to clear Telegram SDK storage:', error);
  }
}

// It is important, to mock the environment only for development purposes. When building the
// application, the code inside will be tree-shaken, so you will not see it in your final bundle.
export async function mockEnv(): Promise<void> {
  return process.env.NODE_ENV !== 'development'
  ? undefined
  : isTMA('complete').then((isTma) => {
    // Only mock if we're not in a real Telegram environment AND we want to test Telegram features
    // Check for a URL parameter to enable mocking (e.g., ?mock-telegram=true)
    const urlParams = new URLSearchParams(window.location.search);
    const shouldMock = urlParams.get('mock-telegram') === 'true';
    
    // If not in Telegram environment and not mocking, clear any persisted SDK state
    if (!isTma && !shouldMock) {
      clearTelegramSDKStorage();
    }
    
    if (!isTma && shouldMock) { 
      const themeParams = {
        accent_text_color: '#6ab2f2',
        bg_color: '#17212b',
        button_color: '#5288c1',
        button_text_color: '#ffffff',
        destructive_text_color: '#ec3942',
        header_bg_color: '#17212b',
        hint_color: '#708499',
        link_color: '#6ab3f3',
        secondary_bg_color: '#232e3c',
        section_bg_color: '#17212b',
        section_header_text_color: '#6ab3f3',
        subtitle_text_color: '#708499',
        text_color: '#f5f5f5',
      } as const;
      const noInsets = { left: 0, top: 0, bottom: 0, right: 0 } as const;
  
      mockTelegramEnv({
        onEvent(e) {
          // Here you can write your own handlers for all known Telegram Mini Apps methods.
          if (e[0] === 'web_app_request_theme') {
            return emitEvent('theme_changed', { theme_params: themeParams });
          }
          if (e[0] === 'web_app_request_viewport') {
            return emitEvent('viewport_changed', {
              height: window.innerHeight,
              width: window.innerWidth,
              is_expanded: true,
              is_state_stable: true,
            });
          }
          if (e[0] === 'web_app_request_content_safe_area') {
            return emitEvent('content_safe_area_changed', noInsets);
          }
          if (e[0] === 'web_app_request_safe_area') {
            return emitEvent('safe_area_changed', noInsets);
          }
        },
        launchParams: new URLSearchParams([
          // Discover more launch parameters:
          // https://docs.telegram-mini-apps.com/platform/launch-parameters#parameters-list
          ['tgWebAppThemeParams', JSON.stringify(themeParams)],
          // Your init data goes here. Learn more about it here:
          // https://docs.telegram-mini-apps.com/platform/init-data#parameters-list
          //
          // Note that to make sure, you are using a valid init data, you must pass it exactly as it
          // is sent from the Telegram application. The reason is in case you will sort its keys
          // (auth_date, hash, user, etc.) or values your own way, init data validation will more
          // likely to fail on your server side. So, to make sure you are working with a valid init
          // data, it is better to take a real one from your application and paste it here. It should
          // look something like this (a correctly encoded URL search params):
          // ```
          // user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%22%2C%22last_name%22...
          // ```
          // But in case you don't really need a valid init data, use this one:
          ['tgWebAppData', new URLSearchParams([
            ['auth_date', (new Date().getTime() / 1000 | 0).toString()],
            ['hash', 'some-hash'],
            ['signature', 'some-signature'],
            ['user', JSON.stringify({ id: 1, first_name: 'Vladislav' })],
          ]).toString()],
          ['tgWebAppVersion', '8.4'],
          ['tgWebAppPlatform', 'tdesktop'],
        ]),
      });
  
      console.info(
        '⚠️ Telegram environment mocked for testing. Add ?mock-telegram=true to URL to enable mocking.',
      );
    } else if (!isTma) {
      console.info(
        'ℹ️ Running in regular browser mode. Add ?mock-telegram=true to URL to test Telegram Web App features.',
      );
    }
  });
}
