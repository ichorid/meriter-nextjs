import { cookies, headers } from 'next/headers';
import { detectBrowserLanguage, type Locale } from '@/i18n/locale';
import enMessages from '../../../messages/en.json';
import ruMessages from '../../../messages/ru.json';

export type MultiObrazMessageShape = (typeof ruMessages)['multiObraz'];

export async function getPilotServerLocale(): Promise<Locale> {
  const cookieVal = (await cookies()).get('NEXT_LOCALE')?.value;
  if (cookieVal === 'ru' || cookieVal === 'en') {
    return cookieVal;
  }
  const acceptLang = (await headers()).get('accept-language') ?? undefined;
  return detectBrowserLanguage(acceptLang);
}

export function getMultiObrazMessages(locale: Locale): MultiObrazMessageShape {
  return locale === 'ru' ? ruMessages.multiObraz : enMessages.multiObraz;
}
