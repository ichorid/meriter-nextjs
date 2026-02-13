import { create } from 'zustand';
import type { Locale } from '@/i18n/request';

// Initial messages so portaled content has translations before ClientRootLayout effect runs
import enMessages from '../../messages/en.json';

export type IntlMessages = Record<string, unknown>;

interface IntlPortalState {
  locale: Locale;
  messages: IntlMessages;
}

interface IntlPortalActions {
  setIntl: (locale: Locale, messages: IntlMessages) => void;
}

export const useIntlPortalStore = create<IntlPortalState & IntlPortalActions>()((set) => ({
  locale: 'en',
  messages: enMessages as IntlMessages,
  setIntl: (locale, messages) => set({ locale, messages }),
}));
