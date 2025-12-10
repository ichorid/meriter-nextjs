'use client';

import { useState, useMemo, useCallback, memo, useEffect } from "react";
import { etv } from '@shared/lib/input-utils';
import Slider from "rc-slider";
import { classList } from '@lib/classList';
import { useTranslations } from 'next-intl';
import { useToastStore } from '@/shared/stores/toast.store';
import 'rc-slider/assets/index.css';

export interface FormCommentVoteBaseProps {
    comment: string;
    setComment: (value: string) => void;
    freePlus: number;
    freeMinus: number;
    amount: number;
    setAmount: (amount: number) => void;
    maxPlus: number;
    maxMinus: number;
    commentAdd: (data: any) => void;
    error: string;
    reason?: string;
    orientation?: 'horizontal' | 'vertical';
    isWithdrawMode?: boolean;
    quotaAmount?: number;
    walletAmount?: number;
    quotaRemaining?: number;
    currencyIconUrl?: string;
}

export const FormCommentVoteBase = memo(({
    comment,
    setComment,
    freePlus,
    freeMinus,
    amount,
    setAmount,
    maxPlus,
    maxMinus,
    commentAdd,
    error,
    reason,
    orientation = 'horizontal',
    isWithdrawMode = false,
    quotaAmount = 0,
    walletAmount = 0,
    quotaRemaining = 0,
    currencyIconUrl,
}: FormCommentVoteBaseProps) => {
    const t = useTranslations('comments');
    const addToast = useToastStore((state) => state.addToast);
    const [selected, setSelected] = useState(false);
    const overflow = amount >= 0 ? amount > freePlus : amount < -freeMinus;
    const directionPlus = amount > 0;
    const directionMinus = amount < 0;
    const isVertical = orientation === 'vertical';

    // Slider configuration
    const maxRange = Math.max(maxPlus, maxMinus);
    const sliderMin = isWithdrawMode ? 0 : (maxMinus === 0 ? 0 : (isVertical ? -maxRange : -maxMinus));
    const sliderMax = isWithdrawMode ? maxPlus : (isVertical ? maxRange : maxPlus);

    // Memoize onChange handler
    const handleSliderChange = useCallback((value: number | number[]) => {
        const newAmount = typeof value === 'number' ? value : value[0] || 0;
        const clampedAmount = isWithdrawMode 
            ? Math.max(0, Math.min(newAmount, maxPlus))
            : Math.max(-maxMinus, Math.min(newAmount, maxPlus));
        setAmount(clampedAmount);
    }, [isWithdrawMode, maxPlus, maxMinus, setAmount]);

    // Vertical slider styles
    const trackStyle = useMemo(() => {
        if (!isVertical) return undefined;
        const range = sliderMax - sliderMin;
        if (amount > 0) {
            const zeroPosition = ((0 - sliderMin) / range) * 100;
            const amountPosition = ((amount - sliderMin) / range) * 100;
            return {
                backgroundColor: '#10b981',
                bottom: `${zeroPosition}%`,
                height: `${amountPosition - zeroPosition}%`
            };
        } else if (amount < 0) {
            const zeroPosition = ((0 - sliderMin) / range) * 100;
            const amountPosition = ((amount - sliderMin) / range) * 100;
            return {
                backgroundColor: '#ef4444',
                top: `${amountPosition}%`,
                height: `${zeroPosition - amountPosition}%`
            };
        }
        return { backgroundColor: 'transparent' };
    }, [isVertical, amount, sliderMin, sliderMax]);

    const railStyle = useMemo(() => {
        if (!isVertical) return undefined;
        return {
            background: 'linear-gradient(to bottom, #10b981 0%, #10b981 35%, #e5e7eb 35%, #e5e7eb 65%, #ef4444 65%, #ef4444 100%)'
        };
    }, [isVertical]);

    const handleStyle = useMemo(() => {
        if (!isVertical) return undefined;
        return {
            backgroundColor: amount > 0 ? '#10b981' : amount < 0 ? '#ef4444' : '#6b7280',
            borderColor: amount > 0 ? '#10b981' : amount < 0 ? '#ef4444' : '#6b7280',
            boxShadow: amount !== 0 ? `0 0 0 3px ${amount > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` : 'none',
        };
    }, [isVertical, amount]);

    // Show error toast when error changes
    useEffect(() => {
        if (error) {
            addToast(error, 'error');
        }
    }, [error, addToast]);

    // Format amount display for vertical mode
    const formatAmountDisplay = () => {
        if (!isVertical) return null;
        
        if (directionPlus) {
            return (
                <>
                    {quotaAmount > 0 && <span>+{quotaAmount}</span>}
                    {walletAmount > 0 && (
                        <span className="flex items-center gap-1">
                            {currencyIconUrl && (
                                <img src={currencyIconUrl} alt="Currency" className="w-6 h-6" />
                            )}
                            :+{walletAmount}
                        </span>
                    )}
                    {quotaAmount === 0 && walletAmount === 0 && (
                        <span>{amount > 0 ? '+' : ''}{amount}</span>
                    )}
                </>
            );
        } else if (directionMinus) {
            return (
                <>
                    {walletAmount > 0 ? (
                        <>
                            {currencyIconUrl && (
                                <img src={currencyIconUrl} alt="Currency" className="w-6 h-6" />
                            )}
                            <span>:{Math.abs(amount)}</span>
                        </>
                    ) : (
                        <span>{amount}</span>
                    )}
                </>
            );
        } else {
            return <span>{amount > 0 ? '+' : ''}{amount}</span>;
        }
    };

    return (
        <div
            className={classList(
                "p-5 rounded-2xl shadow-lg",
                directionPlus ? "bg-success/10" : directionMinus ? "bg-error/10" : "bg-base-100"
            )}
        >
            <div className="border-t-2 border-base-300 w-full mb-4"></div>
            
            {/* Amount display at top (vertical only) */}
            {isVertical && (
                <div className="text-center mb-4">
                    <div className={classList(
                        "text-3xl font-bold flex items-center justify-center gap-2",
                        directionPlus ? "text-success" : directionMinus ? "text-error" : "text-secondary"
                    )}>
                        {formatAmountDisplay()}
                    </div>
                    <div className="text-xs opacity-60 mt-1">
                        {isWithdrawMode ? t('withdrawAmount') : t('voteAmount')}
                    </div>
                </div>
            )}

            {/* Quota/Balance info */}
            {directionPlus && (
                <div className="text-sm mb-2 text-success">
                    {t('upvoteQuota', { used: Math.min(freePlus, Math.abs(amount)), total: freePlus })}
                </div>
            )}
            {directionPlus && (
                <div className="text-sm mb-2 text-success">
                    {t('upvoteBalance', { amount: overflow ? amount - freePlus : 0 })}
                </div>
            )}
            {amount === 0 && !isWithdrawMode && (
                <div className="text-sm mb-2 opacity-60">{t('sliderUpvote')}</div>
            )}
            {amount === 0 && maxMinus != 0 && !isWithdrawMode && (
                <div className="text-sm mb-2 opacity-60">{t('sliderDownvote')}</div>
            )}
            {directionMinus && freeMinus > 0 && !isWithdrawMode && (
                <div className="text-sm mb-2 text-error">
                    {t('downvoteQuota', { used: Math.min(freeMinus, Math.abs(amount)), total: freeMinus })}
                </div>
            )}
            {directionMinus && !isWithdrawMode && (
                <div className="text-sm mb-2 text-error">
                    {t('downvoteBalance', { amount: overflow ? amount - freeMinus : 0 })}
                </div>
            )}

            {/* Slider */}
            {isVertical ? (
                <div className="mb-4 flex justify-center">
                    <div className="relative" style={{ height: '220px' }}>
                        <Slider
                            vertical={true}
                            min={sliderMin}
                            max={sliderMax}
                            value={amount}
                            onChange={handleSliderChange}
                            className="rc-slider-vertical"
                            trackStyle={trackStyle}
                            railStyle={railStyle}
                            handleStyle={handleStyle}
                        />
                        {!isWithdrawMode && (
                            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                                <div className="w-8 h-8 rounded-full bg-base-200 border-2 border-base-300 flex items-center justify-center">
                                    <span className="text-xs font-bold text-base-content">0</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="mb-4 px-2">
                    <Slider
                        min={sliderMin}
                        max={sliderMax}
                        value={amount}
                        onChange={handleSliderChange}
                    />
                </div>
            )}

            {/* Textarea and submit */}
            <div className="relative">
                <textarea
                    onClick={() => setSelected(true)}
                    className="textarea textarea-bordered w-full bg-base-100 text-base resize-none"
                    style={selected ? { height: "100px" } : { height: "75px" }}
                    placeholder={
                        reason ?? amount == 0
                            ? t('sliderHint')
                            : t('commentHint')
                    }
                    {...etv(comment, setComment)}
                />
                {amount != 0 && (
                    <button
                        onClick={() => commentAdd(directionPlus ? true : false)}
                        disabled={amount < 0 && !comment?.trim()}
                          className={classList(
                              "btn btn-circle btn-primary absolute bottom-2 right-2",
                              amount < 0 && !comment?.trim() ? "opacity-50 cursor-not-allowed" : ""
                          )}
                    >
                        <img src={"/meriter/send.svg"} alt="Send" className="w-5 h-5" />
                    </button>
                )}
            </div>
            
            {/* Warning for vertical mode when comment is empty */}
            {isVertical && amount !== 0 && !comment?.trim() && (
                <div className="text-sm text-warning p-2 bg-warning/10 rounded-lg mt-2">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                            <div className="font-medium">{t('reasonRequired')}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

FormCommentVoteBase.displayName = 'FormCommentVoteBase';

