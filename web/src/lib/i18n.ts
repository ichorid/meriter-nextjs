import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Simplified client-side i18n initialization
// Translations are now loaded server-side and passed to the provider
i18n.use(initReactI18next).init({
    resources: {}, // Will be populated by server-side translations
    lng: 'en', // Default, will be overridden by server
    fallbackLng: 'en',
    ns: [
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
    ],
    defaultNS: 'common',
    interpolation: {
        escapeValue: false,
    },
    // Disable automatic language detection since we handle it server-side
    detection: {
        order: [],
        caches: [],
    },
});

export default i18n;

