'use client';

import { ChangeEvent, useState } from "react";
import { useTranslations } from 'next-intl';
import { useUpdatesFrequency, useSetUpdatesFrequency } from '@/hooks/api/useUsers';

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
            frequency: 'immediately',
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
    ];

    return (
        <div id={"updates-frequency"} className="form-control w-full">
            <label className="label">
                <span className="label-text">{t('updateFrequency.selectFrequency')}</span>
            </label>
            <select
                className="select select-bordered w-full max-w-xs"
                value={frequency || options.find((o) => o.default)?.frequency}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setFrequency(e.target.value);
                }}
                disabled={isUpdating}
            >
                {options.map((o, i) => (
                    <option
                        key={i}
                        value={o.frequency}
                    >
                        {o.label}
                    </option>
                ))}
            </select>
            {isUpdating && (
                <label className="label">
                    <span className="label-text-alt text-base-content/70">Updating...</span>
                </label>
            )}
        </div>
    );
};
