'use client';

import { useState } from "react";
import { useTranslations } from 'next-intl';
import { useUpdatesFrequency, useSetUpdatesFrequency } from '@/hooks/api/useUsers';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { cn } from '@/lib/utils';

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
    const selectOptions = options.map(o => ({ label: o.label, value: o.frequency }));

    return (
        <div id="updates-frequency">
            <BrandFormControl label={t('updateFrequency.telegramBotFrequency')}>
                <Select value={currentFrequency} onValueChange={setFrequency} disabled={isUpdating}>
                    <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                        <SelectValue placeholder={options.find(o => o.frequency === currentFrequency)?.label} />
                    </SelectTrigger>
                    <SelectContent>
                        {selectOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </BrandFormControl>
        </div>
    );
};
