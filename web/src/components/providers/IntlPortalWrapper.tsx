'use client';

import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useIntlPortalStore } from '@/stores/intl-portal.store';

type IntlProviderMessages = React.ComponentProps<typeof NextIntlClientProvider>['messages'];

/**
 * Wraps children in NextIntlClientProvider using locale and messages from the portal store.
 * Use around content that is rendered inside a React portal (e.g. BottomPortal), where
 * the main NextIntlClientProvider context is not available.
 */
export function IntlPortalWrapper({ children }: { children: React.ReactNode }) {
  const { locale, messages } = useIntlPortalStore();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages as IntlProviderMessages}
      timeZone="UTC"
    >
      {children}
    </NextIntlClientProvider>
  );
}
