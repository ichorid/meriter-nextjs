'use client';

import { useState, useMemo, useCallback, memo } from "react";
import { etv } from '@shared/lib/input-utils';
import Slider from "rc-slider";
import { classList } from '@lib/classList';
import { useTranslations } from 'next-intl';
import 'rc-slider/assets/index.css';

interface iFormCommentVoteVerticalProps {
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
    isWithdrawMode?: boolean;
    quotaAmount?: number;
    walletAmount?: number;
    quotaRemaining?: number;
    currencyIconUrl?: string;
}

export const FormCommentVoteVertical = memo(({
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
    isWithdrawMode = false,
    quotaAmount = 0,
    walletAmount = 0,
    quotaRemaining = 0,
    currencyIconUrl,
}: iFormCommentVoteVerticalProps) => {
    const t = useTranslations('comments');
    const [selected, setSelected] = useState(false);
    const overflow = amount >= 0 ? amount > freePlus : amount < -freeMinus;
    const directionPlus = amount > 0 ? true : false;
    const directionMinus = amount < 0 ? true : false;

    // For symmetric range around 0 (to center the slider), use the max of both directions
    // This ensures amount=0 is always at 50% (center)
    const maxRange = Math.max(maxPlus, maxMinus);
    const sliderMin = isWithdrawMode ? 0 : -maxRange;
    const sliderMax = isWithdrawMode ? maxPlus : maxRange;

    // Memoize onChange handler to prevent unnecessary re-renders
    const handleSliderChange = useCallback((value: number | number[]) => {
        const newAmount = typeof value === 'number' ? value : value[0] || 0;
        // Clamp to actual limits even though slider range is symmetric
        const clampedAmount = isWithdrawMode 
            ? Math.max(0, Math.min(newAmount, maxPlus))
            : Math.max(-maxMinus, Math.min(newAmount, maxPlus));
        setAmount(clampedAmount);
    }, [isWithdrawMode, maxPlus, maxMinus, setAmount]);

    // Memoize trackStyle calculation - extract complex IIFE to useMemo
    const trackStyle = useMemo(() => {
        const range = sliderMax - sliderMin;
        if (amount > 0) {
            // Green for positive (top portion of slider)
            // Position of 0: (0 - sliderMin) / range
            // Position of amount: (amount - sliderMin) / range
            // Track from 0 position to amount position
            const zeroPosition = ((0 - sliderMin) / range) * 100;
            const amountPosition = ((amount - sliderMin) / range) * 100;
            return {
                backgroundColor: '#10b981',
                bottom: `${zeroPosition}%`,
                height: `${amountPosition - zeroPosition}%`
            };
        } else if (amount < 0) {
            // Red for negative (bottom portion of slider)
            const zeroPosition = ((0 - sliderMin) / range) * 100;
            const amountPosition = ((amount - sliderMin) / range) * 100;
            return {
                backgroundColor: '#ef4444',
                top: `${amountPosition}%`,
                height: `${zeroPosition - amountPosition}%`
            };
        }
        return { backgroundColor: 'transparent' };
    }, [amount, sliderMin, sliderMax]);

    // Memoize rail style
    const railStyle = useMemo(() => ({ 
        // Rail shows red on bottom (negative), green on top (positive)
        // For vertical slider: 0% = top, 100% = bottom
        // So green at top (0%), red at bottom (100%)
        background: 'linear-gradient(to bottom, #10b981 0%, #10b981 35%, #e5e7eb 35%, #e5e7eb 65%, #ef4444 65%, #ef4444 100%)'
    }), []);

    // Memoize handle style
    const handleStyle = useMemo(() => ({
        backgroundColor: amount > 0 ? '#10b981' : amount < 0 ? '#ef4444' : '#6b7280',
        borderColor: amount > 0 ? '#10b981' : amount < 0 ? '#ef4444' : '#6b7280',
        boxShadow: amount !== 0 ? `0 0 0 3px ${amount > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}` : 'none',
    }), [amount]);

    return (
        <div
            className={classList(
                "p-5 rounded-2xl shadow-lg",
                directionPlus ? "bg-success/10" : directionMinus ? "bg-error/10" : "bg-base-100"
            )}
        >
            <div className="border-t-2 border-base-300 w-full mb-4"></div>
            
            {/* Amount display at top */}
            <div className="text-center mb-4">
                <div className={classList(
                    "text-3xl font-bold flex items-center justify-center gap-2",
                    directionPlus ? "text-success" : directionMinus ? "text-error" : "text-secondary"
                )}>
                    {directionPlus ? (
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
                    ) : directionMinus ? (
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
                    ) : (
                        <span>{amount > 0 ? '+' : ''}{amount}</span>
                    )}
                </div>
                <div className="text-xs opacity-60 mt-1">
                    {isWithdrawMode ? t('withdrawAmount') : t('voteAmount')}
                </div>
            </div>

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

            {/* Vertical Slider */}
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
                    {/* Center zero indicator for bidirectional sliders */}
                    {!isWithdrawMode && (
                        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                            <div className="w-8 h-8 rounded-full bg-base-200 border-2 border-base-300 flex items-center justify-center">
                                <span className="text-xs font-bold text-base-content">0</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

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
                        className="btn btn-circle btn-primary absolute bottom-2 right-2"
                    >
                        <img src={"/meriter/send.svg"} alt="Send" className="w-5 h-5" />
                    </button>
                )}
            </div>
            {amount !== 0 && !comment?.trim() && (
                <div className="alert alert-warning mt-2">
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
            {error && <div className="alert alert-error mt-2">{error}</div>}
        </div>
    );
});

FormCommentVoteVertical.displayName = 'FormCommentVoteVertical';
