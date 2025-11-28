'use client';

import { type PropsWithChildren, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { ThemeProvider } from '@/shared/lib/theme-provider';

const NavigationBar = dynamic(() => import('./organisms/NavigationBar/NavigationBar').then(mod => ({ default: mod.NavigationBar })), { ssr: false });
const ToastContainer = dynamic(() => import('@/shared/components/toast-container').then(mod => ({ default: mod.ToastContainer })), { ssr: false });

export default function TelegramSDKWrapper({ children }: PropsWithChildren) {
  const [appearance, setAppearance] = useState<'light' | 'dark'>('light');
  const [platform, setPlatform] = useState<'base' | 'ios'>('base');

  useEffect(() => {
    // Check for Telegram theme
    try {
      const tgWebApp = (window as any).Telegram?.WebApp;
      if (tgWebApp) {
        const isDark = tgWebApp.isDark || false;
        setAppearance(isDark ? 'dark' : 'light');
        
        const tgPlatform = tgWebApp.platform || '';
        if (['macos', 'ios'].includes(tgPlatform)) {
          setPlatform('ios');
        }
      }
    } catch (e) {
      // Not in Telegram environment
    }
  }, []);

  return (
    <ThemeProvider>
      <AppRoot appearance={appearance} platform={platform}>
        <NavigationBar />
        {children}
        <ToastContainer />
      </AppRoot>
    </ThemeProvider>
  );
}
