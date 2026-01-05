'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { useTheme } from '@/shared/lib/theme-provider';
import { cn } from '@/lib/utils';

export function ThemeSelector() {
    const t = useTranslations('settings');
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [selectedValue, setSelectedValue] = useState<string>('auto');

    useEffect(() => {
        // Sync with ThemeProvider
        setSelectedValue(theme);
    }, [theme]);

    const changeTheme = (value: string) => {
        const newTheme = value as 'light' | 'dark' | 'auto';
        setSelectedValue(newTheme);
        setTheme(newTheme);
    };

    const options = [
        { label: `${t('themeAuto')} (${resolvedTheme === 'dark' ? t('themeDark') : t('themeLight')})`, value: 'auto' },
        { label: t('themeLight'), value: 'light' },
        { label: t('themeDark'), value: 'dark' },
    ];

    return (
        <BrandFormControl label={t('theme')}>
            <Select value={selectedValue} onValueChange={changeTheme}>
                <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                    <SelectValue placeholder={t('themeAuto')} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </BrandFormControl>
    );
}

