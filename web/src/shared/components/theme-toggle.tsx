'use client';

import { useTheme } from '../lib/theme-provider';

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();

    const cycleTheme = () => {
        if (theme === 'light') {
            setTheme('dark');
        } else if (theme === 'dark') {
            setTheme('auto');
        } else {
            setTheme('light');
        }
    };

    const getIcon = () => {
        if (theme === 'auto') {
            return 'brightness_auto';
        }
        return resolvedTheme === 'dark' ? 'dark_mode' : 'light_mode';
    };

    const getLabel = () => {
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
            title={`Theme: ${getLabel()}`}
        >
            <span className="material-symbols-outlined">{getIcon()}</span>
        </button>
    );
}

