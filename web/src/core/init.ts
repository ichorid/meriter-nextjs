import {
  setDebug,
  mountBackButton,
  restoreInitData,
  init as initSDK,
  mountMiniAppSync,
  bindThemeParamsCssVars,
  mountViewport,
  bindViewportCssVars,
  mockTelegramEnv,
  type ThemeParams,
  themeParamsState,
  retrieveLaunchParams,
  emitEvent,
  isTMA,
} from '@telegram-apps/sdk-react';

/**
 * Initializes the application and configures its dependencies.
 */
export async function init(options: {
  debug: boolean;
  eruda: boolean;
  mockForMacOS: boolean;
}): Promise<void> {
  // Set @telegram-apps/sdk-react debug mode and initialize it.
  setDebug(options.debug);
  
  // Only initialize SDK if we're in a Telegram environment or mocking is enabled
  try {
    const isInTelegram = await isTMA('complete');
    if (isInTelegram) {
      initSDK();
    } else {
      // Check if mocking is enabled via URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const shouldMock = urlParams.get('mock-telegram') === 'true';
      
      if (shouldMock) {
        // Mock environment first, then initialize
        console.log('🔧 Mocking Telegram environment before SDK init');
        initSDK();
      } else {
        console.log('🌐 Running in regular browser mode - skipping Telegram SDK init');
        // Skip SDK initialization for regular web usage
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to determine Telegram environment, skipping SDK init:', error);
  }

  // Add Eruda if needed.
  options.eruda &&
    void import('eruda').then(({ default: eruda }) => {
      eruda.init();
      eruda.position({ x: window.innerWidth - 50, y: 0 });
    });

  // Telegram for macOS has a ton of bugs, including cases, when the client doesn't
  // even response to the "web_app_request_theme" method. It also generates an incorrect
  // event for the "web_app_request_safe_area" method.
  if (options.mockForMacOS) {
    let firstThemeSent = false;
    mockTelegramEnv({
      onEvent(event, next) {
        if (event[0] === 'web_app_request_theme') {
          let tp: ThemeParams = {};
          if (firstThemeSent) {
            tp = themeParamsState();
          } else {
            firstThemeSent = true;
            try {
              tp ||= retrieveLaunchParams().tgWebAppThemeParams;
            } catch (error) {
              console.warn('Failed to retrieve launch params for theme:', error);
            }
          }
          return emitEvent('theme_changed', { theme_params: tp });
        }

        if (event[0] === 'web_app_request_safe_area') {
          return emitEvent('safe_area_changed', {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          });
        }

        next();
      },
    });
  }

  // Mount all components used in the project.
  mountBackButton.ifAvailable();
  
  // Only restore init data if we're in Telegram environment or mocking
  try {
    const isInTelegram = await isTMA('complete');
    const urlParams = new URLSearchParams(window.location.search);
    const shouldMock = urlParams.get('mock-telegram') === 'true';
    
    if (isInTelegram || shouldMock) {
      restoreInitData();
    } else {
      console.log('🌐 Skipping restoreInitData - not in Telegram environment');
    }
  } catch (error) {
    console.warn('⚠️ Failed to restore init data:', error);
  }

  // Only mount Telegram-specific components if we're in Telegram environment
  try {
    const isInTelegram = await isTMA('complete');
    if (isInTelegram) {
      if (mountMiniAppSync.isAvailable()) {
        mountMiniAppSync();
        bindThemeParamsCssVars();
      }

      if (mountViewport.isAvailable()) {
        mountViewport().then(() => {
          bindViewportCssVars();
        });
      }
    } else {
      // Check if mocking is enabled for regular web usage
      const urlParams = new URLSearchParams(window.location.search);
      const shouldMock = urlParams.get('mock-telegram') === 'true';
      
      if (shouldMock) {
        if (mountMiniAppSync.isAvailable()) {
          mountMiniAppSync();
          bindThemeParamsCssVars();
        }

        if (mountViewport.isAvailable()) {
          mountViewport().then(() => {
            bindViewportCssVars();
          });
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Failed to mount Telegram components:', error);
  }
}
