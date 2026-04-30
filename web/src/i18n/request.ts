import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, detectBrowserLanguage, type Locale } from './locale';

/**
 * next-intl plugin entry (`next.config.js` → `createNextIntlPlugin('./src/i18n/request.ts')`).
 * Enables `getTranslations` / `getFormatter` in Server Components (e.g. pilot create page).
 *
 * Locale helpers live in `./locale` (safe for client imports — no `next/headers`).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // Multi-Obraz pilot standalone: lock locale to Russian.
  // Even if system/browser language is English, pilot UI must stay RU.
  if (process.env.NEXT_PUBLIC_PILOT_STANDALONE === 'true') {
    const messages = (await import('../../messages/ru.json')).default;
    return { locale: 'ru', messages, timeZone: 'UTC' };
  }

  const fromSegment = await requestLocale;
  let locale: Locale =
    fromSegment === 'ru' || fromSegment === 'en' ? fromSegment : DEFAULT_LOCALE;

  if (fromSegment !== 'ru' && fromSegment !== 'en') {
    const cookieVal = (await cookies()).get('NEXT_LOCALE')?.value;
    if (cookieVal === 'ru' || cookieVal === 'en') {
      locale = cookieVal;
    } else {
      const acceptLang = (await headers()).get('accept-language') ?? undefined;
      locale = detectBrowserLanguage(acceptLang);
    }
  }

  const messages =
    locale === 'ru'
      ? (await import('../../messages/ru.json')).default
      : (await import('../../messages/en.json')).default;

  return {
    locale,
    messages,
    timeZone: 'UTC',
  };
});
