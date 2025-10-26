// This file is normally used for setting up analytics and other
// services that require one-time initialization on the client.

import { retrieveLaunchParams, isTMA } from '@telegram-apps/sdk-react';
import { detectTelegramEnvironment } from './lib/telegram-env-detector';
import { init } from './core/init';
import { mockEnv } from './mockEnv';
import { config } from './config';

mockEnv().then(async () => {
  try {
    // Early detection using our utility
    const detection = detectTelegramEnvironment();
    
    if (!detection.isTelegramMiniApp) {
      console.log('🌐 Desktop browser mode detected - skipping Telegram-specific initialization');
      // Just initialize with defaults for desktop mode
      const debug = config.app.isDevelopment;
      init({
        debug,
        eruda: false,
        mockForMacOS: false,
      });
      return;
    }

    // We're in Telegram Mini App mode, proceed with full initialization
    console.log('📱 Telegram Mini App mode detected');

    let launchParams;
    try {
      launchParams = retrieveLaunchParams();
    } catch (e) {
      console.warn('Failed to retrieve launch params, using defaults:', e);
      launchParams = { 
        tgWebAppPlatform: 'web',
        tgWebAppStartParam: ''
      };
    }
    
    const { tgWebAppPlatform: platform } = launchParams;
    const debug =
      (launchParams.tgWebAppStartParam || '').includes('debug') ||
      config.app.isDevelopment;

    // Configure all application dependencies
    init({
      debug,
      eruda: debug && ['ios', 'android'].includes(platform),
      mockForMacOS: platform === 'macos',
    });
  } catch (e) {
    console.error('Failed to initialize app:', e);
  }
});
