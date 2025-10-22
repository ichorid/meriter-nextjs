import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

export type Locale = 'en' | 'ru';
export type LocalePreference = 'en' | 'ru' | 'auto';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ru'];
export const DEFAULT_LOCALE: Locale = 'en';

export const TRANSLATION_NAMESPACES = [
    'common',
    'home',
    'login',
    'wallet',
    'settings',
    'polls',
    'feed',
    'comments',
    'communities',
    'shared',
    'pages',
] as const;

export type TranslationNamespace = typeof TRANSLATION_NAMESPACES[number];

export interface Translations {
    [namespace: string]: Record<string, any>;
}

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

/**
 * Load translations for a specific locale and namespace
 */
export function loadTranslationFile(locale: Locale, namespace: TranslationNamespace): Record<string, any> {
    try {
        const filePath = path.join(process.cwd(), 'public', 'locales', locale, `${namespace}.json`);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error(`Failed to load translation file: ${locale}/${namespace}`, error);
        return {};
    }
}

/**
 * Load all translations for a specific locale
 */
export function loadAllTranslations(locale: Locale): Translations {
    const translations: Translations = {};
    
    for (const namespace of TRANSLATION_NAMESPACES) {
        translations[namespace] = loadTranslationFile(locale, namespace);
    }
    
    return translations;
}

/**
 * Get locale and translations for server-side rendering
 */
export async function getServerTranslations(acceptLanguage?: string): Promise<{
    locale: Locale;
    translations: Translations;
}> {
    const locale = await getLocaleFromCookie(acceptLanguage);
    const translations = loadAllTranslations(locale);
    
    return { locale, translations };
}
