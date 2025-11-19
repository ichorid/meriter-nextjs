'use client';

import { useState } from "react";
import { useTranslations } from 'next-intl';
import { useUpdatesFrequency, useSetUpdatesFrequency } from '@/hooks/api/useUsers';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { Select, SelectTrigger, SelectInput, SelectIcon, SelectPortal, SelectBackdrop, SelectContent, SelectDragIndicatorWrapper, SelectDragIndicator, SelectItem } from '@/components/ui/select';
import { ChevronDownIcon } from '@gluestack-ui/themed';
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Spinner } from '@/components/ui/spinner';

export const UpdatesFrequency = () => {
    const t = useTranslations('pages');
    const [isUpdating, setIsUpdating] = useState(false);
    
    const { data: frequencyData } = useUpdatesFrequency();
    const setFrequencyMutation = useSetUpdatesFrequency();

    const frequency = frequencyData?.frequency || 'daily';

    const setFrequency = async (freq: string) => {
        setIsUpdating(true);
        try {
            await setFrequencyMutation.mutateAsync(freq);
        } finally {
            setIsUpdating(false);
        }
    };

    const options = [
        {
            frequency: 'immediate',
            label: t('updateFrequency.immediately'),
        },
        {
            frequency: 'hourly',
            label: t('updateFrequency.oncePerHour'),
            default: true,
        },
        {
            frequency: 'daily',
            label: t('updateFrequency.oncePerDay'),
        },
        {
            frequency: 'never',
            label: t('updateFrequency.never'),
        },
    ];

    const currentFrequency = frequency || options.find((o) => o.default)?.frequency || 'daily';

    return (
        <Box id="updates-frequency">
            <FormControl>
                <FormControlLabel>
                    <FormControlLabelText>{t('updateFrequency.telegramBotFrequency')}</FormControlLabelText>
                </FormControlLabel>
                <Select
                    selectedValue={currentFrequency}
                    onValueChange={setFrequency}
                    isDisabled={isUpdating}
                >
                    <SelectTrigger variant="outline" width="100%" maxWidth={320}>
                        <SelectInput placeholder={options.find(o => o.frequency === currentFrequency)?.label} />
                        <SelectIcon mr="$3">
                            {isUpdating ? <Spinner size="small" /> : <ChevronDownIcon />}
                        </SelectIcon>
                    </SelectTrigger>
                    <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                            <SelectDragIndicatorWrapper>
                                <SelectDragIndicator />
                            </SelectDragIndicatorWrapper>
                            {options.map((o) => (
                                <SelectItem 
                                    key={o.frequency}
                                    label={o.label} 
                                    value={o.frequency} 
                                />
                            ))}
                        </SelectContent>
                    </SelectPortal>
                </Select>
            </FormControl>
        </Box>
    );
};
