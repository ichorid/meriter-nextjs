import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TelegramWebAppUser } from '@/types/telegram';

interface TelegramState {
  isInTelegram: boolean;
  initData: string | null;
  initDataUnsafe: any;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: any;
  user: TelegramWebAppUser | null;
  ready: boolean;
}

interface TelegramActions {
  init: () => void;
  setUser: (user: TelegramWebAppUser | null) => void;
  setInitData: (initData: string) => void;
  setColorScheme: (scheme: 'light' | 'dark') => void;
  setReady: (ready: boolean) => void;
}

export const useTelegramStore = create<TelegramState & TelegramActions>()(
  devtools(
    (set) => ({
      isInTelegram: false,
      initData: null,
      initDataUnsafe: {},
      version: '',
      platform: '',
      colorScheme: 'light',
      themeParams: {},
      user: null,
      ready: false,
      
      init: () => {
        if (typeof window === 'undefined') return;
        
        try {
          const tgWebApp = (window as any).Telegram?.WebApp;
          
          if (tgWebApp) {
            set({
              isInTelegram: tgWebApp.initDataUnsafe?.user !== undefined,
              initData: tgWebApp.initData || null,
              initDataUnsafe: tgWebApp.initDataUnsafe || {},
              version: tgWebApp.version || '',
              platform: tgWebApp.platform || '',
              colorScheme: (tgWebApp.themeParams?.colorScheme as 'light' | 'dark') || 'light',
              themeParams: tgWebApp.themeParams || {},
              user: tgWebApp.initDataUnsafe?.user || null,
              ready: tgWebApp.isReady || false,
            });
            
            // Expand WebApp
            tgWebApp.expand();
            
            // Enable closing confirmation
            tgWebApp.enableClosingConfirmation();
            
            // Handle theme changes
            tgWebApp.onEvent('themeChanged', () => {
              set({ 
                colorScheme: (tgWebApp.themeParams?.colorScheme as 'light' | 'dark') || 'light',
                themeParams: tgWebApp.themeParams || {},
              });
            });
          }
        } catch (error) {
          console.warn('Failed to initialize Telegram WebApp:', error);
        }
      },
      
      setUser: (user) => set({ user }),
      setInitData: (initData) => set({ initData }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setReady: (ready) => set({ ready }),
    }),
    { name: 'TelegramStore' }
  )
);
