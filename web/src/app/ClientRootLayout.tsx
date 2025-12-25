'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useState, useMemo, Suspense } from 'react';
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

// Detect locale from cookies/localStorage/browser
function detectLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  try {
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
  } catch {
    // If cookies/localStorage are not available, use default
    return DEFAULT_LOCALE;
  }
}

export default function ClientRootLayout({ children }: ClientRootLayoutProps) {
  // Always start with DEFAULT_LOCALE to match pre-rendered HTML from static export
  // This prevents hydration mismatches - locale will be updated after mount
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState(enMessages);

  useEffect(() => {
    // Detect and update locale after mount to avoid hydration mismatches
    // The initial render uses DEFAULT_LOCALE which matches the pre-rendered HTML
    const detectedLocale = detectLocale();
    
    // Always update locale if different from current state
    // This ensures the UI reflects the user's language preference
    if (detectedLocale !== locale) {
      setLocale(detectedLocale);
      setMessages(detectedLocale === 'ru' ? ruMessages : enMessages);
    }

    // Always update document language attribute
    document.documentElement.lang = detectedLocale;

    // Set cookie if not already set
    if (!document.cookie.includes('NEXT_LOCALE=')) {
      const browserLang = navigator.language?.split('-')[0]?.toLowerCase() || 'en';
      const defaultLocale = browserLang === 'ru' ? 'ru' : 'en';
      document.cookie = `NEXT_LOCALE=${defaultLocale}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once after mount - locale state is intentionally excluded to avoid loops

  // Note: Auth config is now provided via RuntimeConfigProvider which uses tRPC
  // These are fallback values used only during initial render before runtime config loads
  // They will be overridden by RuntimeConfigProvider once the API config is fetched
  // Memoize to prevent infinite re-renders (these functions create new objects/arrays each call)
  const fallbackEnabledProviders = useMemo(() => {
    const env = getAuthEnv(null); // No runtime config available at this level
    return getEnabledProviders(env);
  }, []); // Empty deps - these are static fallback values
  const fallbackAuthnEnabled = false; // Default to false, will be set by RuntimeConfigProvider

  // Always render the full app structure to avoid hydration mismatches
  // The initial render uses default locale, which will be updated after mount
  // Use suppressHydrationWarning on NextIntlClientProvider to prevent hydration warnings
  // since locale changes after mount are expected and handled gracefully
  return (
    <StyledJsxRegistry>
      <AppModeProvider>
        <QueryProvider>
          <NextIntlClientProvider 
            locale={locale} 
            messages={messages}
            timeZone="UTC"
            // Suppress hydration warning since locale detection happens client-side after mount
            // This is safe because NextIntl handles locale changes gracefully
          >
            <Suspense fallback={null}>
              <ClientRouter />
            </Suspense>
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
