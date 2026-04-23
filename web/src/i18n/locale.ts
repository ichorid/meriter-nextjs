export type Locale = 'en' | 'ru';
export type LocalePreference = 'en' | 'ru' | 'auto';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ru'];

function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'ru';
}

/**
 * Returns the deployment-level default locale.
 * Reads NEXT_PUBLIC_DEFAULT_LOCALE env var; falls back to 'en'.
 */
export function getDefaultLocale(): Locale {
  const env = process.env.NEXT_PUBLIC_DEFAULT_LOCALE;
  return isLocale(env) ? env : 'en';
}

export const DEFAULT_LOCALE: Locale = getDefaultLocale();

/**
 * Detect browser language from Accept-Language header or navigator.
 */
export function detectBrowserLanguage(acceptLanguage?: string): Locale {
  if (typeof window !== 'undefined' && !acceptLanguage) {
    const browserLang = navigator.language?.split('-')[0]?.toLowerCase() || 'en';
    return isLocale(browserLang) ? browserLang : DEFAULT_LOCALE;
  }

  if (!acceptLanguage) return DEFAULT_LOCALE;

  const languages = acceptLanguage
    .split(',')
    .map((lang) => lang.split(';')[0]?.trim().toLowerCase() || '')
    .map((lang) => lang.split('-')[0] || '');

  if (languages.includes('ru')) return 'ru';

  return DEFAULT_LOCALE;
}
