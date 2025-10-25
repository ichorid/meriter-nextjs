import React from 'react';
import { Button, Icon } from '@/components/atoms';
import { useThemeStore } from '@/stores/theme.store';

export interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, setTheme, resolvedTheme } = useThemeStore();
  
  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('auto');
    } else {
      setTheme('light');
    }
  };

  const getIcon = (): string => {
    if (theme === 'auto') {
      return 'brightness_auto';
    }
    return resolvedTheme === 'dark' ? 'dark_mode' : 'light_mode';
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      className={className}
    >
      <Icon name={getIcon()} size={20} />
    </Button>
  );
};
