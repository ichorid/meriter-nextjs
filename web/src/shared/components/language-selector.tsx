'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
// Gluestack UI components
import { Select, SelectTrigger, SelectInput, SelectIcon, SelectPortal, SelectBackdrop, SelectContent, SelectDragIndicatorWrapper, SelectDragIndicator, SelectItem } from '@/components/ui/select';
import { ChevronDownIcon } from '@gluestack-ui/themed';
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';

export function LanguageSelector() {
    const t = useTranslations('settings');
    const [selectedValue, setSelectedValue] = useState('auto');

    useEffect(() => {
        // Get the stored preference or default to 'auto'
        const stored = localStorage.getItem('language') || 'auto';
        setSelectedValue(stored);
    }, []);

    const changeLanguage = async (value: string) => {
        setSelectedValue(value);
        localStorage.setItem('language', value);
        
        try {
            // Set cookie directly
            document.cookie = `NEXT_LOCALE=${value}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax`;
            
            // Reload page to get server-side rendering with new language
            window.location.reload();
        } catch (error) {
            console.error('Failed to set locale:', error);
        }
    };

    return (
        <FormControl>
            <FormControlLabel>
                <FormControlLabelText>{t('language')}</FormControlLabelText>
            </FormControlLabel>
            <Select
                selectedValue={selectedValue}
                onValueChange={changeLanguage}
            >
                <SelectTrigger variant="outline" width="100%" maxWidth={320}>
                    <SelectInput placeholder={t('languageAuto')} />
                    <SelectIcon mr="$3">
                        <ChevronDownIcon />
                    </SelectIcon>
                </SelectTrigger>
                <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                        <SelectDragIndicatorWrapper>
                            <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        <SelectItem label={t('languageAuto')} value="auto" />
                        <SelectItem label="English" value="en" />
                        <SelectItem label="Русский" value="ru" />
                    </SelectContent>
                </SelectPortal>
            </Select>
        </FormControl>
    );
}

