'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useState, useRef, Suspense, startTransition } from 'react';
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
import { DevToolsBar } from '@/components/organisms/DevToolsBar/DevToolsBar';
import { isTestAuthMode } from '@/config';
// Import auth debug utilities (only active in development)
import '@/lib/utils/auth-debug';

import enMessages from '../../messages/en.json';
import ruMessages from '../../messages/ru.json';

interface ClientRootLayoutProps {
  children: React.ReactNode;
}

// Stable fallback values computed once at module load time
// This ensures the same reference is used during static generation and client hydration
// Prevents hydration mismatches and infinite render loops in production
const FALLBACK_ENABLED_PROVIDERS = (() => {
  const env = getAuthEnv(null);
  return getEnabledProviders(env);
})();

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
  const hasInitializedLocale = useRef(false);

  useEffect(() => {
    // Only run once after mount to avoid hydration mismatches and infinite loops
    if (hasInitializedLocale.current) {
      return;
    }
    hasInitializedLocale.current = true;

    // Detect and update locale after mount to avoid hydration mismatches
    // The initial render uses DEFAULT_LOCALE which matches the pre-rendered HTML
    const detectedLocale = detectLocale();
    
    // Always update locale if different from DEFAULT_LOCALE
    // This ensures the UI reflects the user's language preference
    // Use startTransition to batch the state update and prevent refresh loops
    if (detectedLocale !== DEFAULT_LOCALE) {
      startTransition(() => {
        setLocale(detectedLocale);
        setMessages(detectedLocale === 'ru' ? ruMessages : enMessages);
      });
    }

    // Always update document language attribute
    document.documentElement.lang = detectedLocale;

    // Set cookie if not already set - use detectedLocale to ensure consistency
    // This prevents mismatches between detected locale and cookie value
    if (!document.cookie.includes('NEXT_LOCALE=')) {
      // Use SameSite=Lax (first-party) to avoid browser rejections on misconfigured Secure flags.
      // This is correct because Meriter runs on a single origin (no cross-site cookie use required).
      const isSecure = window.location.protocol === 'https:';
      const secureFlag = isSecure ? '; secure' : '';
      document.cookie = `NEXT_LOCALE=${detectedLocale}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax${secureFlag}`;
    }
  }, []); // Empty deps - only run once after mount

  // Note: Auth config is now provided via RuntimeConfigProvider which uses tRPC
  // These are fallback values used only during initial render before runtime config loads
  // They will be overridden by RuntimeConfigProvider once the API config is fetched
  // Use stable module-level constant to prevent hydration mismatches in production
  const fallbackEnabledProviders = FALLBACK_ENABLED_PROVIDERS;
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
            // Locale detection happens client-side after mount to avoid hydration mismatches
            // This is safe because NextIntl handles locale changes gracefully
          >
            <Suspense fallback={null}>
              <ClientRouter />
            </Suspense>
            <AuthProvider>
              {isTestAuthMode() && <DevToolsBar />}
              <RuntimeConfigProvider
                fallbackEnabledProviders={fallbackEnabledProviders}
                fallbackAuthnEnabled={fallbackAuthnEnabled}
              >
                <div className={isTestAuthMode() ? 'pt-[60px]' : ''}>
                  <Root>{children}</Root>
                </div>
              </RuntimeConfigProvider>
              <ToastContainer />
            </AuthProvider>
          </NextIntlClientProvider>
        </QueryProvider>
      </AppModeProvider>
    </StyledJsxRegistry>
  );
}
