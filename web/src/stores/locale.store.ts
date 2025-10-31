import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type Locale = 'en' | 'ru' | 'auto';

interface LocaleState {
  locale: Locale;
  resolvedLocale: 'en' | 'ru';
}

interface LocaleActions {
  setLocale: (locale: Locale) => void;
  setResolvedLocale: (locale: 'en' | 'ru') => void;
}

const getBrowserLocale = (): 'en' | 'ru' => {
  if (typeof window === 'undefined') return 'en';
  
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  return browserLang.startsWith('ru') ? 'ru' : 'en';
};

export const useLocaleStore = create<LocaleState & LocaleActions>()(
  devtools(
    persist(
      (set) => ({
        locale: 'auto',
        resolvedLocale: getBrowserLocale(),
        
        setLocale: (locale) => {
          const resolvedLocale = locale === 'auto' ? getBrowserLocale() : locale;
          set({ locale, resolvedLocale });
        },
        
        setResolvedLocale: (locale) => {
          set({ resolvedLocale: locale });
        },
      }),
      { name: 'meriter-locale' }
    ),
    { name: 'LocaleStore' }
  )
);
