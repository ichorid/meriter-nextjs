import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export type Locale = 'en' | 'ru';
export type LocalePreference = 'en' | 'ru' | 'auto';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ru'];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Detect browser language from Accept-Language header
 */
export function detectBrowserLanguage(acceptLanguage?: string): Locale {
    if (!acceptLanguage) return DEFAULT_LOCALE;
    
    const languages = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0].trim().toLowerCase())
        .map(lang => lang.split('-')[0]); // Extract primary language
    
    // Check for Russian first
    if (languages.includes('ru')) return 'ru';
    
    // Default to English
    return DEFAULT_LOCALE;
}

/**
 * Get locale from cookie with fallback to browser detection
 */
export async function getLocaleFromCookie(acceptLanguage?: string): Promise<Locale> {
    const cookieStore = await cookies();
    const localePreference = cookieStore.get('NEXT_LOCALE')?.value as LocalePreference;
    
    if (localePreference === 'auto') {
        return detectBrowserLanguage(acceptLanguage);
    }
    
    if (localePreference && SUPPORTED_LOCALES.includes(localePreference as Locale)) {
        return localePreference as Locale;
    }
    
    // Fallback to browser detection if no cookie or invalid value
    return detectBrowserLanguage(acceptLanguage);
}

export default getRequestConfig(async () => {
    // Get locale from cookie/browser detection
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    const locale = await getLocaleFromCookie(acceptLanguage || undefined);

    // Validate locale
    if (!SUPPORTED_LOCALES.includes(locale as Locale)) {
        notFound();
    }

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default
    };
});
