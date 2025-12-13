'use client';

import { useState } from "react";
import { useTranslations } from 'next-intl';
import { useUpdatesFrequency, useSetUpdatesFrequency } from '@/hooks/api/useUsers';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';

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
        <div id="updates-frequency">
            <BrandFormControl label={t('updateFrequency.telegramBotFrequency')}>
                <BrandSelect
                    value={currentFrequency}
                    onChange={setFrequency}
                    options={options.map(o => ({ label: o.label, value: o.frequency }))}
                    placeholder={options.find(o => o.frequency === currentFrequency)?.label}
                    disabled={isUpdating}
                    fullWidth
                />
            </BrandFormControl>
        </div>
    );
};
