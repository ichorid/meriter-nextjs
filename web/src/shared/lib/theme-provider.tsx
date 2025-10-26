'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { initDataRaw, miniApp, useSignal } from '@telegram-apps/sdk-react';

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
    
    // Use SDK signals with error handling
    let rawData;
    let isDark;
    let isInTelegram = false;
    
    try {
        rawData = useSignal(initDataRaw);
        isDark = useSignal(miniApp.isDark);
        isInTelegram = !!rawData;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn('⚠️ Telegram Web App not detected in theme provider, using fallback:', message);
        rawData = { value: null };
        isDark = { value: false };
        isInTelegram = false;
    }

    // Initialize theme from localStorage
    useEffect(() => {
        if (!isInTelegram) {
            const stored = localStorage.getItem('theme') as Theme | null;
            if (stored && ['light', 'dark', 'auto'].includes(stored)) {
                console.log('🎨 Using stored theme:', stored);
                setThemeState(stored);
            }
        }
    }, [isInTelegram]);

    // Use Telegram theme when in Telegram
    useEffect(() => {
        if (isInTelegram) {
            console.log('🎨 Using Telegram theme:', isDark ? 'dark' : 'light');
            setResolvedTheme(isDark ? 'dark' : 'light');
        }
    }, [isInTelegram, isDark]);

    // Update resolved theme based on theme setting and system preference (non-Telegram)
    useEffect(() => {
        if (isInTelegram) return; // Skip if using Telegram theme
        
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
        console.log('🎨 Setting theme:', newTheme);
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
        
        if (isInTelegram) {
            console.log('🎨 In Telegram Web App - theme follows Telegram settings');
        }
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

