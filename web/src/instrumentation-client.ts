// This file is normally used for setting up analytics and other
// services that require one-time initialization on the client.

import { retrieveLaunchParams, isTMA } from '@telegram-apps/sdk-react';
import { init } from './core/init';
import { mockEnv } from './mockEnv';
import { config } from './config';

mockEnv().then(async () => {
  try {
    let launchParams;
    try {
      // Check if we're in Telegram environment first
      const isInTelegram = await isTMA('complete');
      
      if (isInTelegram) {
        launchParams = retrieveLaunchParams();
      } else {
        throw new Error('Not in Telegram environment');
      }
    } catch (e) {
      // Not in Telegram environment, use defaults
      console.log('Not in Telegram environment, using default config');
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
