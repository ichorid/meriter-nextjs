'use client';

import { useState } from "react";
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
}

export const FormCommentVoteVertical = ({
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
}: iFormCommentVoteVerticalProps) => {
    const t = useTranslations('comments');
    const [selected, setSelected] = useState(false);
    const overflow = amount >= 0 ? amount > freePlus : amount < -freeMinus;
    const directionPlus = amount > 0 ? true : false;
    const directionMinus = amount < 0 ? true : false;

    const sliderMin = isWithdrawMode ? 0 : -maxMinus;
    const sliderMax = isWithdrawMode ? maxPlus : maxPlus;

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
                    "text-3xl font-bold",
                    directionPlus ? "text-success" : directionMinus ? "text-error" : "text-secondary"
                )}>
                    {amount > 0 ? '+' : ''}{amount}
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
                        onChange={(value) => setAmount(typeof value === 'number' ? value : value[0] || 0)}
                        className="rc-slider-vertical"
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
            {error && <div className="alert alert-error mt-2">{error}</div>}
        </div>
    );
};
