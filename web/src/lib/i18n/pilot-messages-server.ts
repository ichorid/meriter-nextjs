import { cookies, headers } from 'next/headers';
import { detectBrowserLanguage, type Locale } from '@/i18n/locale';
import enMessages from '../../../messages/en.json';
import ruMessages from '../../../messages/ru.json';

export type MultiObrazMessageShape = (typeof ruMessages)['multiObraz'];

export async function getPilotServerLocale(): Promise<Locale> {
  // Pilot is Russian-only by product requirement.
  // Keep EN messages for development, but do not auto-select them at runtime.
  return 'ru';
}

export function getMultiObrazMessages(locale: Locale): MultiObrazMessageShape {
  return locale === 'ru' ? ruMessages.multiObraz : enMessages.multiObraz;
}
