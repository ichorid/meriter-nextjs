import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import enMessages from '../../messages/en.json';
import ruMessages from '../../messages/ru.json';
import {
  detectBrowserLanguage,
  getDefaultLocale,
  type Locale,
} from './request';

const messagesByLocale = {
  en: enMessages,
  ru: ruMessages,
} as const satisfies Record<Locale, typeof enMessages>;

async function resolveRequestLocale(): Promise<Locale> {
  try {
    const cookieVal = (await cookies()).get('NEXT_LOCALE')?.value;
    if (cookieVal === 'en' || cookieVal === 'ru') {
      return cookieVal;
    }
    const acceptLang = (await headers()).get('accept-language') ?? undefined;
    return detectBrowserLanguage(acceptLang);
  } catch {
    return getDefaultLocale();
  }
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();
  return {
    locale,
    messages: messagesByLocale[locale],
    timeZone: 'UTC',
  };
});
