import { useEffect, useState } from 'react';
import { useTelegramStore } from '@/stores';
import { useAppMode } from '@/contexts/AppModeContext';

export function useTelegramWebApp() {
  const { isTelegramMiniApp } = useAppMode();
  const store = useTelegramStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Only load Telegram SDK in mini app mode
    if (!isTelegramMiniApp) {
      setIsReady(true);
      return;
    }

    // Initialize Telegram WebApp
    store.init();

    // Add script if not already loaded
    const scriptId = 'telegram-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.async = true;
      script.onload = () => {
        store.init();
        setIsReady(true);
      };
      document.head.appendChild(script);
    } else {
      setIsReady(true);
    }
  }, [store, isTelegramMiniApp]);

  return {
    isInTelegram: store.isInTelegram,
    initData: store.initData,
    user: store.user,
    colorScheme: store.colorScheme,
    themeParams: store.themeParams,
    version: store.version,
    platform: store.platform,
    ready: isReady,
  };
}
