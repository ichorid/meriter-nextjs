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
        // Check if in Telegram Web App - use a more robust detection
        const checkTelegram = () => {
            const tg = (window as any).Telegram?.WebApp;
            if (tg) {
                // Very strict detection - only consider it Telegram if we have initData
                // This is the most reliable indicator of being in a real Telegram Web App
                const isTelegramEnvironment = !!tg.initData;
                
                if (isTelegramEnvironment) {
                    setIsInTelegram(true);
                    console.log('🎨 Telegram Web App detected, using Telegram theme');
                    
                    // Use Telegram's theme if available
                    if (tg.colorScheme) {
                        const telegramTheme = tg.colorScheme === 'dark' ? 'dark' : 'light';
                        console.log('🎨 Setting Telegram theme:', telegramTheme);
                        setResolvedTheme(telegramTheme);
                        return;
                    }
                }
            }
            
            // Otherwise use localStorage
            const stored = localStorage.getItem('theme') as Theme | null;
            if (stored && ['light', 'dark', 'auto'].includes(stored)) {
                console.log('🎨 Using stored theme:', stored);
                setThemeState(stored);
            }
        };

        // Check immediately
        checkTelegram();
        
        // Also check after a short delay in case Telegram Web App loads asynchronously
        const timeoutId = setTimeout(checkTelegram, 100);
        
        return () => clearTimeout(timeoutId);
    }, []);

    // Listen for Telegram theme changes
    useEffect(() => {
        if (!isInTelegram) return;
        
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            const handleThemeChange = () => {
                console.log('🎨 Telegram theme changed');
                if (tg.colorScheme) {
                    const telegramTheme = tg.colorScheme === 'dark' ? 'dark' : 'light';
                    console.log('🎨 New Telegram theme:', telegramTheme);
                    setResolvedTheme(telegramTheme);
                }
            };
            
            // Listen for theme changes
            tg.onEvent('themeChanged', handleThemeChange);
            
            // Also check periodically in case the event doesn't fire
            const intervalId = setInterval(() => {
                if (tg.colorScheme) {
                    const telegramTheme = tg.colorScheme === 'dark' ? 'dark' : 'light';
                    setResolvedTheme(telegramTheme);
                }
            }, 1000);
            
            return () => {
                tg.offEvent('themeChanged', handleThemeChange);
                clearInterval(intervalId);
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
        console.log('🎨 Setting theme:', newTheme);
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
        
        // If we're in Telegram, we should respect the Telegram theme
        // But allow manual override for testing purposes
        if (isInTelegram) {
            console.log('🎨 In Telegram Web App - theme override applied');
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

