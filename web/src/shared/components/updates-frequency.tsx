'use client';

import { swr } from "@lib/swr";
import axios from "axios";
import { ChangeEvent } from "react";
import { useTranslation } from 'react-i18next';

export const UpdatesFrequency = () => {
    const { t } = useTranslation('pages');
    const endpoint = "/api/rest/freq";
    const [frequency, mutateFrequency] = swr(endpoint, 0);

    const setFrequency = (freq) => {
        axios.post(endpoint, { updateFrequencyMs: freq });
        mutateFrequency(freq);
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
                    setFrequency(e.target.value);
                }}
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
        </div>
    );
};
