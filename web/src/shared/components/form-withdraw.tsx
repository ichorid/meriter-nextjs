'use client';

import { useState } from "react";
import { etv } from '@shared/lib/input-utils';
import { Slider, SliderTrack, SliderFilledTrack, SliderThumb } from '@/components/ui/slider';
import { useTranslations } from 'next-intl';

interface FormWithdrawProps {
    comment: string;
    setComment: (comment: string) => void;
    amount: number;
    setAmount: (amount: number) => void;
    maxWithdrawAmount: number;
    maxTopUpAmount: number;
    onSubmit: () => void;
    children: React.ReactNode;
    isWithdrawal: boolean;
}

export const FormWithdraw: React.FC<FormWithdrawProps> = ({
    comment,
    setComment,
    amount,
    setAmount,
    maxWithdrawAmount,
    maxTopUpAmount,
    onSubmit,
    children,
    isWithdrawal,
}) => {
    const t = useTranslations('shared');
    const [selected, setSelected] = useState(false);

    return (
        <div className="card bg-base-100 shadow-lg dark:border dark:border-base-content/20 rounded-2xl p-5">
            <div className="border-t-2 border-base-300 dark:border-base-content/20 w-full mb-4"></div>

            <div className="text-sm mb-4 opacity-70">{children}</div>

            {((isWithdrawal && maxWithdrawAmount >= 1) ||
                (!isWithdrawal && maxTopUpAmount >= 1)) && (
                <div>
                    <div className="mb-4 px-2">
                        <Slider
                            minValue={0}
                            maxValue={
                                isWithdrawal
                                    ? maxWithdrawAmount
                                    : maxTopUpAmount
                            }
                            value={amount}
                            onChange={(value) => setAmount(value)}
                        >
                            <SliderTrack
                                style={{
                                    height: 6,
                                    borderRadius: 8,
                                    backgroundColor: 'var(--fallback-b3,oklch(var(--b3)/1))',
                                }}
                            >
                                <SliderFilledTrack
                                    style={{
                                        height: 6,
                                        borderRadius: 8,
                                        backgroundColor: 'var(--fallback-p,oklch(var(--p)/1))',
                                    }}
                                />
                            </SliderTrack>
                            <SliderThumb
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    backgroundColor: 'var(--fallback-bc,oklch(var(--bc)/1))',
                                    boxShadow: '-2px 2px 8px rgba(0, 0, 0, 0.2)',
                                }}
                            />
                        </Slider>
                    </div>
                    <div className="flex justify-end mt-4">
                        <button
                            onClick={onSubmit}
                            className="btn btn-primary"
                        >
                            {t('submit')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
