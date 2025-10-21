import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const detectBrowserLanguage = (): string => {
    if (typeof window === 'undefined') return 'en';
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'ru' ? 'ru' : 'en';
};

const getBrowserLanguage = (): string => {
    if (typeof window === 'undefined') return 'en';

    const stored = localStorage.getItem('language');
    
    // If user explicitly chose a language, use it
    if (stored && ['en', 'ru'].includes(stored)) {
        return stored;
    }
    
    // If 'auto' or no preference, detect from browser
    return detectBrowserLanguage();
};

i18n.use(initReactI18next).init({
    resources: {}, // Loaded dynamically
    lng: getBrowserLanguage(),
    fallbackLng: 'en',
    ns: ['common', 'home', 'login', 'wallet', 'settings'],
    defaultNS: 'common',
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;

