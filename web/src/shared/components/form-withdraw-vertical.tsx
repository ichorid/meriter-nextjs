'use client';

import { useState, useCallback } from "react";
import { etv } from '@shared/lib/input-utils';
import { Slider, SliderTrack, SliderFilledTrack, SliderThumb } from '@/components/ui/slider';
import { classList } from '@lib/classList';
import { useTranslations } from 'next-intl';

interface FormWithdrawVerticalProps {
    comment: string;
    setComment: (value: string) => void;
    amount: number;
    setAmount: (amount: number) => void;
    maxWithdrawAmount: number;
    maxTopUpAmount: number;
    onSubmit: () => void;
    onClose: () => void;
    isWithdrawal: boolean;
    isLoading?: boolean;
    currencyIconUrl?: string;
}

export const FormWithdrawVertical: React.FC<FormWithdrawVerticalProps> = ({
    comment,
    setComment,
    amount,
    setAmount,
    maxWithdrawAmount,
    maxTopUpAmount,
    onSubmit,
    onClose,
    isWithdrawal,
    isLoading = false,
    currencyIconUrl,
}) => {
    const t = useTranslations('shared');
    const [selected, setSelected] = useState(false);
    
    const maxAmount = isWithdrawal ? maxWithdrawAmount : maxTopUpAmount;
    const disabled = !amount || amount <= 0;

    const handleSliderChange = useCallback((value: number) => {
        setAmount(Math.max(0, Math.min(value, maxAmount)));
    }, [maxAmount, setAmount]);

    return (
        <div className="p-5 rounded-xl shadow-lg bg-base-100">
            {/* Header */}
            <div className="mb-4">
                <div className="text-xl font-bold mb-2">
                    {isWithdrawal ? t('withdraw') : t('addCommunityPoints', { amount: 0 })}
                </div>
                <div className="text-sm opacity-70">
                    {isWithdrawal 
                        ? t('removeCommunityPoints', { amount: 0 }).replace('0', '')
                        : t('addCommunityPoints', { amount: 0 }).replace('0', '')
                    }
                </div>
            </div>

            {/* Amount display */}
            <div className="text-center mb-4">
                <div className={classList(
                    "text-3xl font-bold flex items-center justify-center gap-2",
                    amount > 0 ? "text-primary" : "text-secondary"
                )}>
                    {currencyIconUrl && amount > 0 && (
                        <img src={currencyIconUrl} alt="Currency" className="w-6 h-6" />
                    )}
                    {amount > 0 ? `+${amount}` : amount}
                </div>
                <div className="text-xs opacity-60 mt-1">
                    {isWithdrawal ? t('withdrawAmount') : t('topUpAmount')}
                </div>
            </div>

            {/* Vertical Slider */}
            {maxAmount >= 1 && (
                <div className="mb-4 flex justify-center">
                    <div className="relative" style={{ height: '220px', width: '40px' }}>
                        <Slider
                            orientation="vertical"
                            minValue={0}
                            maxValue={maxAmount}
                            value={amount}
                            onChange={handleSliderChange}
                            style={{ height: '100%' }}
                        >
                            <SliderTrack
                                style={{
                                    width: 6,
                                    borderRadius: 8,
                                    backgroundColor: 'var(--fallback-b3,oklch(var(--b3)/1))',
                                }}
                            >
                                <SliderFilledTrack
                                    style={{
                                        width: 6,
                                        borderRadius: 8,
                                        backgroundColor: amount > 0 
                                            ? 'var(--fallback-p,oklch(var(--p)/1))' 
                                            : 'var(--fallback-b3,oklch(var(--b3)/1))',
                                    }}
                                />
                            </SliderTrack>
                            <SliderThumb
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    backgroundColor: amount > 0 
                                        ? 'var(--fallback-p,oklch(var(--p)/1))' 
                                        : 'var(--fallback-bc,oklch(var(--bc)/1))',
                                    boxShadow: amount !== 0 
                                        ? '0 0 0 3px rgba(16, 185, 129, 0.2)' 
                                        : '-2px 2px 8px rgba(0, 0, 0, 0.2)',
                                }}
                            />
                        </Slider>
                    </div>
                </div>
            )}

            {/* Textarea */}
            <div className="mb-4">
                <textarea
                    onClick={() => setSelected(true)}
                    className="textarea textarea-bordered w-full bg-base-100 text-base resize-none"
                    style={selected ? { height: "100px" } : { height: "75px" }}
                    placeholder={t('addCommentOptional') || "Add a comment (optional)"}
                    {...etv(comment, setComment)}
                />
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
                <button
                    onClick={onClose}
                    className="btn btn-ghost"
                    disabled={isLoading}
                >
                    {t('cancel') || 'Cancel'}
                </button>
                <button
                    onClick={onSubmit}
                    className="btn btn-primary"
                    disabled={disabled || isLoading}
                >
                    {isLoading ? (
                        <>
                            <span className="loading loading-spinner loading-xs"></span>
                            {t('submitting') || 'Submitting...'}
                        </>
                    ) : (
                        t('submit')
                    )}
                </button>
            </div>
        </div>
    );
};

FormWithdrawVertical.displayName = 'FormWithdrawVertical';

