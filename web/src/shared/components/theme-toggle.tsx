'use client';

import { useTheme } from '../lib/theme-provider';
import { initDataRaw, useSignal } from '@telegram-apps/sdk-react';

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
            return 'phone_android'; // Different icon to indicate Telegram mode
        }
        if (theme === 'auto') {
            return 'brightness_auto';
        }
        return resolvedTheme === 'dark' ? 'dark_mode' : 'light_mode';
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

    return (
        <button
            onClick={cycleTheme}
            className="btn btn-ghost btn-circle"
            aria-label={`Theme: ${getLabel()}`}
            title={`Theme: ${getLabel()}${isInTelegram ? ' - Follows Telegram settings' : ''}`}
        >
            <span className="material-symbols-outlined">{getIcon()}</span>
        </button>
    );
}

