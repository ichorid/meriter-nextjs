'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper function to get initial theme from localStorage (client-side only)
function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'auto';
    try {
        const stored = localStorage.getItem('theme') as Theme | null;
        if (stored && (stored === 'light' || stored === 'dark' || stored === 'auto')) {
            return stored;
        }
    } catch {
        // localStorage not available
    }
    return 'auto';
}

// Helper function to get initial resolved theme from data-theme attribute (set by blocking script)
function getInitialResolvedTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    try {
        const dataTheme = document.documentElement.getAttribute('data-theme');
        if (dataTheme === 'dark' || dataTheme === 'light') {
            return dataTheme;
        }
    } catch {
        // document not available
    }
    return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Initialize theme from localStorage (synchronously)
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);
    // Initialize resolvedTheme from data-theme attribute (set by blocking script)
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(getInitialResolvedTheme);

    // Try to use Telegram theme if available
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        
        try {
            const tgWebApp = (window as unknown).Telegram?.WebApp;
            if (tgWebApp?.themeParams) {
                const isDark = tgWebApp.themeParams.colorScheme === 'dark';
                setResolvedTheme(isDark ? 'dark' : 'light');
                
                // Listen for theme changes
                const handleThemeChange = () => {
                    const newIsDark = tgWebApp.themeParams?.colorScheme === 'dark';
                    setResolvedTheme(newIsDark ? 'dark' : 'light');
                };
                
                tgWebApp.onEvent('themeChanged', handleThemeChange);
                return () => {
                    tgWebApp.offEvent('themeChanged', handleThemeChange);
                };
            }
        } catch {
            // Not in Telegram or WebApp not available - continue with normal theme logic
        }
        
        return undefined;
    }, []);

    // Update resolved theme based on theme setting and system preference
    useEffect(() => {
        // Check if Telegram theme is being used
        const tgWebApp = typeof window !== 'undefined' ? (window as unknown).Telegram?.WebApp : null;
        if (tgWebApp?.themeParams) {
            // Telegram theme is handled by the effect above
            return;
        }
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const updateResolvedTheme = () => {
            if (theme === 'auto') {
                setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
            } else {
                setResolvedTheme(theme);
            }
        };

        updateResolvedTheme();

        // Listen for system preference changes when theme is auto
        const handler = () => {
            if (theme === 'auto') {
                updateResolvedTheme();
            }
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [theme]);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [resolvedTheme]);

    const setTheme = (newTheme: Theme) => {
        console.log('🎨 Setting theme:', newTheme);
        
        // Check if Telegram theme is active
        const tgWebApp = typeof window !== 'undefined' ? (window as unknown).Telegram?.WebApp : null;
        if (tgWebApp?.themeParams) {
            console.log('🎨 In Telegram Web App - theme follows Telegram settings');
            return;
        }
        
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
        // resolvedTheme will be updated by the useEffect above
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
