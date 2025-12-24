'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useState, useMemo } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/i18n/request';
import { Root } from '@/components/Root';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { RuntimeConfigProvider } from '@/components/RuntimeConfigProvider';
import { ToastContainer } from '@/shared/components/toast-container';
import { AppModeProvider } from '@/contexts/AppModeContext';
import StyledJsxRegistry from '@/registry';
import { getEnabledProviders, getAuthEnv } from '@/lib/utils/oauth-providers';
import { ClientRouter } from '@/components/ClientRouter';

import enMessages from '../../messages/en.json';
import ruMessages from '../../messages/ru.json';

interface ClientRootLayoutProps {
  children: React.ReactNode;
}

export default function ClientRootLayout({ children }: ClientRootLayoutProps) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState(enMessages);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const detectLocale = (): Locale => {
      const cookieLocale = document.cookie
        .split('; ')
        .find(row => row.startsWith('NEXT_LOCALE='))
        ?.split('=')[1];

      if (cookieLocale === 'ru' || cookieLocale === 'en') {
        return cookieLocale;
      }

      const stored = localStorage.getItem('language');
      if (stored === 'ru' || stored === 'en') {
        return stored;
      }

      const browserLang = navigator.language?.split('-')[0]?.toLowerCase() || 'en';
      return browserLang === 'ru' ? 'ru' : 'en';
    };

    const detectedLocale = detectLocale();
    setLocale(detectedLocale);
    setMessages(detectedLocale === 'ru' ? ruMessages : enMessages);

    document.documentElement.lang = detectedLocale;

    if (!document.cookie.includes('NEXT_LOCALE=')) {
      const browserLang = navigator.language?.split('-')[0]?.toLowerCase() || 'en';
      const defaultLocale = browserLang === 'ru' ? 'ru' : 'en';
      document.cookie = `NEXT_LOCALE=${defaultLocale}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax`;
    }

    setMounted(true);
  }, []);

  // Note: Auth config is now provided via RuntimeConfigProvider which uses tRPC
  // These are fallback values used only during initial render before runtime config loads
  // They will be overridden by RuntimeConfigProvider once the API config is fetched
  // Memoize to prevent infinite re-renders (these functions create new objects/arrays each call)
  const fallbackEnabledProviders = useMemo(() => {
    const env = getAuthEnv(null); // No runtime config available at this level
    return getEnabledProviders(env);
  }, []); // Empty deps - these are static fallback values
  const fallbackAuthnEnabled = false; // Default to false, will be set by RuntimeConfigProvider

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <StyledJsxRegistry>
      <AppModeProvider>
        <QueryProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ClientRouter />
            <AuthProvider>
              <RuntimeConfigProvider
                fallbackEnabledProviders={fallbackEnabledProviders}
                fallbackAuthnEnabled={fallbackAuthnEnabled}
              >
                <Root>{children}</Root>
              </RuntimeConfigProvider>
              <ToastContainer />
            </AuthProvider>
          </NextIntlClientProvider>
        </QueryProvider>
      </AppModeProvider>
    </StyledJsxRegistry>
  );
}
