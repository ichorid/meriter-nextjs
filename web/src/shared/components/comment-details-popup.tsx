'use client';

import React from 'react';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { useTranslations } from 'next-intl';

interface CommentDetailsPopupProps {
    isOpen: boolean;
    onClose: () => void;
    rate: string;
    currencyIcon?: string;
    amountWallet: number;
    amountFree: number;
    upvotes?: number;
    downvotes?: number;
    isUpvote: boolean;
}

export const CommentDetailsPopup: React.FC<CommentDetailsPopupProps> = ({
    isOpen,
    onClose,
    rate,
    currencyIcon,
    amountWallet,
    amountFree,
    upvotes,
    downvotes,
    isUpvote,
}) => {
    const t = useTranslations('comments');

    if (!isOpen) {
        return null;
    }

    // Build breakdown text: [currency icon]:[+-]X [+-Y] where X is wallet, Y is quota
    const breakdownParts: string[] = [];
    
    if (amountWallet > 0) {
        const sign = isUpvote ? '+' : '-';
        breakdownParts.push(`${sign}${amountWallet}`);
    }
    
    if (amountFree > 0) {
        const sign = isUpvote ? '+' : '-';
        breakdownParts.push(`${sign}${amountFree}`);
    }

    const breakdown = breakdownParts.length > 0 
        ? `${currencyIcon ? '💎' : ''}${currencyIcon ? ':' : ''}${breakdownParts.join(' ')}`
        : '';

    return (
        <BottomPortal>
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-auto">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                />
                {/* Popup Container */}
                <div className="relative z-10 w-full max-w-md bg-base-100 rounded-t-2xl shadow-2xl pointer-events-auto">
                    <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold">{t('commentDetails') || 'Comment Details'}</h3>
                            <button
                                onClick={onClose}
                                className="btn btn-sm btn-circle btn-ghost"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Total Vote Amount */}
                        <div className="mb-6">
                            <div className="text-sm opacity-70 mb-2">{t('totalVote') || 'Total Vote'}</div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold">{rate}</span>
                                {currencyIcon && (
                                    <img 
                                        src={currencyIcon} 
                                        alt="Currency" 
                                        className="w-6 h-6"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Breakdown */}
                        {breakdown && (
                            <div className="mb-6">
                                <div className="text-sm opacity-70 mb-2">{t('breakdown') || 'Breakdown'}</div>
                                <div className="text-base font-medium">{breakdown}</div>
                            </div>
                        )}

                        {/* Vote Counts */}
                        {(upvotes !== undefined || downvotes !== undefined) && (
                            <div className="flex items-center gap-6">
                                {upvotes !== undefined && upvotes > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-success text-lg">↑</span>
                                        <span className="text-base font-medium">{upvotes}</span>
                                        <span className="text-sm opacity-70">{t('upvotes') || 'upvotes'}</span>
                                    </div>
                                )}
                                {downvotes !== undefined && downvotes > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-error text-lg">↓</span>
                                        <span className="text-base font-medium">{downvotes}</span>
                                        <span className="text-sm opacity-70">{t('downvotes') || 'downvotes'}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </BottomPortal>
    );
};

