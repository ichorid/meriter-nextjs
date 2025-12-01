'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { useTheme } from '@/shared/lib/theme-provider';

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

    return (
        <BrandFormControl label={t('theme')}>
            <BrandSelect
                value={selectedValue}
                onChange={changeTheme}
                options={[
                    { label: `${t('themeAuto')} (${resolvedTheme === 'dark' ? t('themeDark') : t('themeLight')})`, value: 'auto' },
                    { label: t('themeLight'), value: 'light' },
                    { label: t('themeDark'), value: 'dark' },
                ]}
                placeholder={t('themeAuto')}
                fullWidth
            />
        </BrandFormControl>
    );
}

