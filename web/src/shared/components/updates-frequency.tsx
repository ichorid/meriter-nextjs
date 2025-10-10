'use client';

import { swr } from "@lib/swr";
import axios from "axios";
import { ChangeEvent } from "react";

const options = [
    {
        updateFrequencyMs: 1000 * 60,
        label: "Сразу же",
    },
    {
        updateFrequencyMs: 1000 * 60 * 60,
        label: "Не чаще раза в час",
        default: true,
    },
    {
        updateFrequencyMs: 1000 * 60 * 60 * 24,
        label: "Не чаще раза в сутки",
    },
];

export const UpdatesFrequency = () => {
    const endpoint = "/api/rest/freq";
    const [frequency, mutateFrequency] = swr(endpoint, 0);

    const setFrequency = (freq) => {
        axios.post(endpoint, { updateFrequencyMs: freq });
        mutateFrequency(freq);
    };

    return (
        <div id={"updates-frequency"}>
            Выберите частоту обновлений:{" "}
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
