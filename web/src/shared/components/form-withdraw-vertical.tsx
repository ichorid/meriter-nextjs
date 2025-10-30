'use client';

import { useState, useMemo, useCallback, memo } from "react";
import { etv } from '@shared/lib/input-utils';
import Slider from "rc-slider";
import { classList } from '@lib/classList';
import { useTranslations } from 'next-intl';
import 'rc-slider/assets/index.css';

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

export const FormWithdrawVertical: React.FC<FormWithdrawVerticalProps> = memo(({
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

    // Memoize onChange handler to prevent unnecessary re-renders
    const handleSliderChange = useCallback((value: number | number[]) => {
        const newAmount = typeof value === 'number' ? value : value[0] || 0;
        setAmount(Math.max(0, Math.min(newAmount, maxAmount)));
    }, [maxAmount, setAmount]);

    // Memoize track style to prevent object recreation on every render
    const trackStyle = useMemo(() => ({
        backgroundColor: '#10b981',
        bottom: '0%',
        height: `${(amount / maxAmount) * 100}%`
    }), [amount, maxAmount]);

    // Memoize rail style
    const railStyle = useMemo(() => ({
        background: 'linear-gradient(to bottom, #10b981 0%, #10b981 100%)'
    }), []);

    // Memoize handle style
    const handleStyle = useMemo(() => ({
        backgroundColor: amount > 0 ? '#10b981' : '#6b7280',
        borderColor: amount > 0 ? '#10b981' : '#6b7280',
        boxShadow: amount !== 0 ? `0 0 0 3px rgba(16, 185, 129, 0.2)` : 'none',
    }), [amount]);

    return (
        <div className="p-5 rounded-2xl shadow-lg bg-base-100">
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
                    <div className="relative" style={{ height: '220px' }}>
                        <Slider
                            vertical={true}
                            min={0}
                            max={maxAmount}
                            value={amount}
                            onChange={handleSliderChange}
                            className="rc-slider-vertical"
                            trackStyle={trackStyle}
                            railStyle={railStyle}
                            handleStyle={handleStyle}
                        />
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
});

FormWithdrawVertical.displayName = 'FormWithdrawVertical';

