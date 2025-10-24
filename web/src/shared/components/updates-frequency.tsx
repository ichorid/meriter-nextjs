'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from "@/lib/api/client";
import { ChangeEvent, useState } from "react";
import { useTranslations } from 'next-intl';

export const UpdatesFrequency = () => {
    const t = useTranslations('pages');
    const endpoint = "/api/rest/freq";
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = useState(false);

    // Use React Query instead of SWR
    const { data: frequency = null } = useQuery({
        queryKey: ['frequency'],
        queryFn: async () => {
            console.log('🌐 React Query fetching frequency');
            const response = await apiClient.get(endpoint);
            console.log('🌐 React Query frequency response:', response);
            console.log('🌐 React Query frequency data:', response.data);
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    console.log('🌐 Current frequency value:', frequency);

    const setFrequencyMutation = useMutation({
        mutationFn: async (freq: number) => {
            console.log('Setting frequency to:', freq);
            const response = await apiClient.post(endpoint, { updateFrequencyMs: freq });
            console.log('Frequency update response:', response);
            return { freq, response };
        },
        onSuccess: (data) => {
            console.log('Mutation success, updating cache with:', data.freq);
            console.log('Current cache before update:', queryClient.getQueryData(['frequency']));
            // Update the cache with the new value - match the exact structure returned by the query
            queryClient.setQueryData(['frequency'], data.freq);
            console.log('Cache after update:', queryClient.getQueryData(['frequency']));
        },
        onError: (error) => {
            console.error('Failed to update frequency:', error);
        },
    });

    const setFrequency = async (freq: number) => {
        setIsUpdating(true);
        try {
            await setFrequencyMutation.mutateAsync(freq);
        } finally {
            setIsUpdating(false);
        }
    };

    const options = [
        {
            updateFrequencyMs: 1000 * 60,
            label: t('updateFrequency.immediately'),
        },
        {
            updateFrequencyMs: 1000 * 60 * 60,
            label: t('updateFrequency.oncePerHour'),
            default: true,
        },
        {
            updateFrequencyMs: 1000 * 60 * 60 * 24,
            label: t('updateFrequency.oncePerDay'),
        },
    ];

    return (
        <div id={"updates-frequency"}>
            {t('updateFrequency.selectFrequency')}{" "}
            <select
                value={
                    frequency ||
                    options.find((o) => o.default)?.updateFrequencyMs
                }
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setFrequency(Number(e.target.value));
                }}
                disabled={isUpdating}
            >
                {options.map((o, i) => (
                    <option
                        key={i}
                        value={o.updateFrequencyMs}
                    >
                        {o.label}
                    </option>
                ))}
            </select>
            {isUpdating && <span className="ml-2 text-sm text-gray-500">Updating...</span>}
        </div>
    );
};
