import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
}

interface ThemeActions {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  
  // Check if Telegram WebApp provides theme
  try {
    const tgWebApp = (window as any).Telegram?.WebApp;
    if (tgWebApp?.isInTelegram) {
      return tgWebApp.themeParams.colorScheme === 'dark' ? 'dark' : 'light';
    }
  } catch (e) {
    // Not in Telegram, continue
  }
  
  return getSystemTheme();
};

export const useThemeStore = create<ThemeState & ThemeActions>()(
  devtools(
    persist(
      (set, get) => ({
        theme: 'auto',
        resolvedTheme: getInitialTheme(),
        
        setTheme: (theme) => {
          const resolvedTheme = theme === 'auto' ? getSystemTheme() : theme;
          set({ theme, resolvedTheme });
          
          // Apply theme to document
          if (typeof window !== 'undefined') {
            document.documentElement.setAttribute('data-theme', resolvedTheme);
          }
        },
        
        toggleTheme: () => {
          const current = get().resolvedTheme;
          const newTheme = current === 'light' ? 'dark' : 'light';
          set({ resolvedTheme: newTheme });
          
          if (typeof window !== 'undefined') {
            document.documentElement.setAttribute('data-theme', newTheme);
          }
        },
        
        setResolvedTheme: (theme) => {
          set({ resolvedTheme: theme });
          
          if (typeof window !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
          }
        },
      }),
      { 
        name: 'meriter-theme',
        onRehydrateStorage: () => (state) => {
          // Apply theme on rehydration
          if (state && typeof window !== 'undefined') {
            const resolvedTheme = state.theme === 'auto' ? getSystemTheme() : state.theme;
            document.documentElement.setAttribute('data-theme', resolvedTheme);
          }
        },
      }
    ),
    { name: 'ThemeStore' }
  )
);
