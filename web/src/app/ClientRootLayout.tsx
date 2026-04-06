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
import { TelegramHint } from '@/components/TelegramHint';
import { CaptiveBrowserProvider } from '@/lib/captive-browser';
// Import auth debug utilities (only active in development)
import '@/lib/utils/auth-debug';

import enMessages from '../../messages/en.json';
import ruMessages from '../../messages/ru.json';
import { useIntlPortalStore } from '@/stores/intl-portal.store';

interface ClientRootLayoutProps {
  children: React.ReactNode;
  serverLocale?: Locale;
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

export default function ClientRootLayout({ children, serverLocale }: ClientRootLayoutProps) {
  const initialLocale = serverLocale ?? DEFAULT_LOCALE;
  const initialLocaleRef = useRef(initialLocale);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState(initialLocale === 'ru' ? ruMessages : enMessages);
  const hasInitializedLocale = useRef(false);
  const setIntlPortal = useIntlPortalStore((s) => s.setIntl);

  useEffect(() => {
    if (hasInitializedLocale.current) return;
    hasInitializedLocale.current = true;

    const detectedLocale = detectLocale();
    
    if (detectedLocale !== initialLocaleRef.current) {
      startTransition(() => {
        setLocale(detectedLocale);
        setMessages(detectedLocale === 'ru' ? ruMessages : enMessages);
      });
    }

    document.documentElement.lang = detectedLocale;

    if (!document.cookie.includes('NEXT_LOCALE=')) {
      const isSecure = window.location.protocol === 'https:';
      const secureFlag = isSecure ? '; secure' : '';
      document.cookie = `NEXT_LOCALE=${detectedLocale}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax${secureFlag}`;
    }
  }, []);

  // Sync locale and messages to portal store so portaled content (e.g. WithdrawPopup) has intl context
  useEffect(() => {
    setIntlPortal(locale, messages as Record<string, unknown>);
  }, [locale, messages, setIntlPortal]);

  // Note: Auth config is now provided via RuntimeConfigProvider which uses tRPC
  // These are fallback values used only during initial render before runtime config loads
  // They will be overridden by RuntimeConfigProvider once the API config is fetched
  // Use stable module-level constant to prevent hydration mismatches in production
  const fallbackEnabledProviders = FALLBACK_ENABLED_PROVIDERS;
  const fallbackAuthnEnabled = false; // Default to false, will be set by RuntimeConfigProvider

  return (
    <StyledJsxRegistry>
      <AppModeProvider>
        <QueryProvider>
          <NextIntlClientProvider 
            locale={locale} 
            messages={messages}
            timeZone="UTC"
          >
            {/* CaptiveBrowserProvider must wrap both TelegramHint and routed content so login and tg-hint share the same captive state. */}
            <CaptiveBrowserProvider>
              <TelegramHint />
              <Suspense fallback={null}>
                <ClientRouter />
              </Suspense>
              <AuthProvider>
                {isTestAuthMode() && <DevToolsBar />}
                <RuntimeConfigProvider
                  fallbackEnabledProviders={fallbackEnabledProviders}
                  fallbackAuthnEnabled={fallbackAuthnEnabled}
                >
                  <div
                  className={`w-full min-w-0 flex flex-col flex-1 ${isTestAuthMode() ? 'pt-[60px]' : ''}`}
                  style={isTestAuthMode() ? { ['--dev-tools-bar-height' as string]: '60px' } : undefined}
                >
                    <Root>{children}</Root>
                  </div>
                </RuntimeConfigProvider>
                <ToastContainer />
              </AuthProvider>
            </CaptiveBrowserProvider>
          </NextIntlClientProvider>
        </QueryProvider>
      </AppModeProvider>
    </StyledJsxRegistry>
  );
}
