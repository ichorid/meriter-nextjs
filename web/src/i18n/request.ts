/**
 * Client-side locale detection utilities
 * Server-side functions removed for static export
 */

export type Locale = 'en' | 'ru';
export type LocalePreference = 'en' | 'ru' | 'auto';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ru'];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Detect browser language from Accept-Language header or navigator
 */
export function detectBrowserLanguage(acceptLanguage?: string): Locale {
    if (typeof window !== 'undefined' && !acceptLanguage) {
        // Use browser navigator if no header provided
        const browserLang = navigator.language?.split('-')[0]?.toLowerCase() || 'en';
        return browserLang === 'ru' ? 'ru' : 'en';
    }
    
    if (!acceptLanguage) return DEFAULT_LOCALE;
    
    const languages = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0]?.trim().toLowerCase() || '')
        .map(lang => lang.split('-')[0] || ''); // Extract primary language
    
    // Check for Russian first
    if (languages.includes('ru')) return 'ru';
    
    // Default to English
    return DEFAULT_LOCALE;
}
