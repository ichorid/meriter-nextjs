'use client';

import { useTheme } from '../lib/theme-provider';
import { Smartphone, Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    
    // Check if Telegram theme is active
    const isTelegramTheme = typeof window !== 'undefined' && !!(window as unknown).Telegram?.WebApp?.themeParams;

    const cycleTheme = () => {
        if (isTelegramTheme) {
            // In Telegram, show a message that theme follows Telegram settings
            console.log('🎨 Theme toggle clicked in Telegram - theme follows Telegram settings');
            return;
        }
        
        if (theme === 'light') {
            setTheme('dark');
        } else if (theme === 'dark') {
            setTheme('auto');
        } else {
            setTheme('light');
        }
    };

    const getIcon = () => {
        if (isTelegramTheme) {
            return Smartphone; // Different icon to indicate Telegram mode
        }
        if (theme === 'auto') {
            return Sun; // Auto theme uses sun icon
        }
        return resolvedTheme === 'dark' ? Moon : Sun;
    };

    const getLabel = () => {
        if (isTelegramTheme) {
            return `Telegram (${resolvedTheme})`;
        }
        if (theme === 'auto') {
            return `Auto (${resolvedTheme})`;
        }
        return theme === 'dark' ? 'Dark' : 'Light';
    };

    const Icon = getIcon();

    return (
        <button
            onClick={cycleTheme}
            className="btn btn-ghost btn-circle"
            aria-label={`Theme: ${getLabel()}`}
            title={`Theme: ${getLabel()}${isTelegramTheme ? ' - Follows Telegram settings' : ''}`}
        >
            <Icon className="w-5 h-5" />
        </button>
    );
}

