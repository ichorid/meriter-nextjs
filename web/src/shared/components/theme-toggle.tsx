'use client';

import { useTheme } from '../lib/theme-provider';
import { initDataRaw, useSignal } from '@telegram-apps/sdk-react';
import { Smartphone, Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const rawData = useSignal(initDataRaw);
    const isInTelegram = !!rawData;

    const cycleTheme = () => {
        if (isInTelegram) {
            // In Telegram, show a message that theme follows Telegram settings
            console.log('🎨 Theme toggle clicked in Telegram - theme follows Telegram settings');
            // You could show a toast or alert here
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
        if (isInTelegram) {
            return Smartphone; // Different icon to indicate Telegram mode
        }
        if (theme === 'auto') {
            return Sun; // Auto theme uses sun icon
        }
        return resolvedTheme === 'dark' ? Moon : Sun;
    };

    const getLabel = () => {
        if (isInTelegram) {
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
            title={`Theme: ${getLabel()}${isInTelegram ? ' - Follows Telegram settings' : ''}`}
        >
            <Icon className="w-5 h-5" />
        </button>
    );
}

