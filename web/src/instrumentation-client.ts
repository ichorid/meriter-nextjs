// This file is normally used for setting up analytics and other
// services that require one-time initialization on the client.

import { retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { init } from './core/init';
import { mockEnv } from './mockEnv';
import { config } from './config';

mockEnv().then(() => {
  try {
    let launchParams;
    try {
      launchParams = retrieveLaunchParams();
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
