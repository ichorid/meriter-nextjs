'use client';

import { useState } from "react";
import { etv } from '@shared/lib/input-utils';
import Slider from "rc-slider";
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
        <div className="card bg-base-100 shadow-lg rounded-2xl p-5">
            <div className="border-t-2 border-base-300 w-full mb-4"></div>

            <div className="text-sm mb-4 opacity-70">{children}</div>

            {((isWithdrawal && maxWithdrawAmount >= 1) ||
                (!isWithdrawal && maxTopUpAmount >= 1)) && (
                <div>
                    <div className="mb-4 px-2">
                        <Slider
                            min={0}
                            max={
                                isWithdrawal
                                    ? maxWithdrawAmount
                                    : maxTopUpAmount
                            }
                            value={amount}
                            onChange={(value) => setAmount(typeof value === 'number' ? value : value[0] || 0)}
                        />
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
