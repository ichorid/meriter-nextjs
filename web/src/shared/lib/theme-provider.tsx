'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('auto');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
    const [isInTelegram, setIsInTelegram] = useState(false);

    // Initialize theme from localStorage or Telegram
    useEffect(() => {
        // Check if in Telegram Web App
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.initData) {
            setIsInTelegram(true);
            // Use Telegram's theme if available
            if (tg.colorScheme) {
                const telegramTheme = tg.colorScheme === 'dark' ? 'dark' : 'light';
                setResolvedTheme(telegramTheme);
                return;
            }
        }
        
        // Otherwise use localStorage
        const stored = localStorage.getItem('theme') as Theme | null;
        if (stored && ['light', 'dark', 'auto'].includes(stored)) {
            setThemeState(stored);
        }
    }, []);

    // Listen for Telegram theme changes
    useEffect(() => {
        if (!isInTelegram) return;
        
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            const handleThemeChange = () => {
                if (tg.colorScheme) {
                    const telegramTheme = tg.colorScheme === 'dark' ? 'dark' : 'light';
                    setResolvedTheme(telegramTheme);
                }
            };
            
            tg.onEvent('themeChanged', handleThemeChange);
            
            return () => {
                tg.offEvent('themeChanged', handleThemeChange);
            };
        }
    }, [isInTelegram]);

    // Update resolved theme based on theme setting and system preference
    useEffect(() => {
        // Skip if using Telegram theme
        if (isInTelegram) return;
        
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const updateResolvedTheme = () => {
            if (theme === 'auto') {
                setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
            } else {
                setResolvedTheme(theme);
            }
        };

        updateResolvedTheme();

        // Listen for system preference changes
        const handler = () => {
            if (theme === 'auto') {
                updateResolvedTheme();
            }
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [theme, isInTelegram]);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [resolvedTheme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
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

