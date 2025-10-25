'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from "@/lib/api/client";
import { ChangeEvent, useState } from "react";
import { useTranslations } from 'next-intl';

export const UpdatesFrequency = () => {
    const t = useTranslations('pages');
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = useState(false);

    // Use React Query instead of SWR
    const { data: frequencyData = null } = useQuery({
        queryKey: ['updates-frequency'],
        queryFn: async () => {
            console.log('🌐 React Query fetching updates frequency');
            const response = await apiClient.get('/api/v1/users/me/updates-frequency');
            console.log('🌐 React Query updates frequency response:', response);
            return response;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    const frequency = frequencyData?.frequency || 'daily';

    console.log('🌐 Current frequency value:', frequency);

    const setFrequencyMutation = useMutation({
        mutationFn: async (freq: string) => {
            console.log('Setting frequency to:', freq);
            const response = await apiClient.put('/api/v1/users/me/updates-frequency', { frequency: freq });
            console.log('Frequency update response:', response);
            return { freq, response };
        },
        onSuccess: (data) => {
            console.log('Mutation success, updating cache with:', data.freq);
            console.log('Current cache before update:', queryClient.getQueryData(['updates-frequency']));
            // Update the cache with the new value
            queryClient.setQueryData(['updates-frequency'], { frequency: data.freq });
            console.log('Cache after update:', queryClient.getQueryData(['updates-frequency']));
        },
        onError: (error) => {
            console.error('Failed to update frequency:', error);
        },
    });

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
        <div id={"updates-frequency"}>
            {t('updateFrequency.selectFrequency')}{" "}
            <select
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
            {isUpdating && <span className="ml-2 text-sm text-gray-500">Updating...</span>}
        </div>
    );
};
