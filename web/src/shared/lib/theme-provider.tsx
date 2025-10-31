'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { initDataRaw, miniApp, useSignal } from '@telegram-apps/sdk-react';
import { useAppMode } from '@/contexts/AppModeContext';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { isTelegramMiniApp } = useAppMode();
    const [theme, setThemeState] = useState<Theme>('auto');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
    
    // Use SDK signals only in mini app mode
    let rawData;
    let isDark;
    
    if (isTelegramMiniApp) {
        try {
            rawData = useSignal(initDataRaw);
            isDark = useSignal(miniApp.isDark);
        } catch (error: unknown) {
            console.warn('⚠️ Telegram SDK signals not available');
            rawData = { value: null };
            isDark = { value: false };
        }
    } else {
        rawData = { value: null };
        isDark = { value: false };
    }

    // Initialize theme from localStorage
    useEffect(() => {
        if (!isTelegramMiniApp) {
            const stored = localStorage.getItem('theme') as Theme | null;
            if (stored && (stored === 'light' || stored === 'dark' || stored === 'auto')) {
                console.log('🎨 Using stored theme:', stored);
                setThemeState(stored);
            } else {
                // Default to auto (follow system preference)
                setThemeState('auto');
            }
        }
    }, [isTelegramMiniApp]);

    // Use Telegram theme when in Telegram
    useEffect(() => {
        if (isTelegramMiniApp) {
            console.log('🎨 Using Telegram theme:', isDark ? 'dark' : 'light');
            setResolvedTheme(isDark ? 'dark' : 'light');
        }
    }, [isTelegramMiniApp, isDark]);

    // Update resolved theme based on theme setting and system preference (non-Telegram)
    useEffect(() => {
        if (isTelegramMiniApp) return; // Skip if using Telegram theme
        
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
    }, [theme, isTelegramMiniApp]);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [resolvedTheme]);

    const setTheme = (newTheme: Theme) => {
        console.log('🎨 Setting theme:', newTheme);
        if (!isTelegramMiniApp) {
            setThemeState(newTheme);
            localStorage.setItem('theme', newTheme);
            // resolvedTheme will be updated by the useEffect above
        } else {
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

