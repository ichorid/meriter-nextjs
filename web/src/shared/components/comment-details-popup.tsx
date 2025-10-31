'use client';

import React from 'react';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { useTranslations } from 'next-intl';
import { AvatarWithPlaceholder } from './avatar-with-placeholder';
import { CommunityAvatar } from './community-avatar';
import { formatDate } from '@/shared/lib/date';

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
    authorName?: string;
    authorAvatar?: string;
    commentContent?: string;
    timestamp?: string;
    communityName?: string;
    communityAvatar?: string;
    beneficiaryName?: string;
    beneficiaryAvatar?: string;
    isVoteTransaction?: boolean;
    totalScore?: number;
    totalReceived?: number;
    totalWithdrawn?: number;
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
    authorName,
    authorAvatar,
    commentContent,
    timestamp,
    communityName,
    communityAvatar,
    beneficiaryName,
    beneficiaryAvatar,
    isVoteTransaction = false,
    totalScore,
    totalReceived,
    totalWithdrawn,
}) => {
    const t = useTranslations('comments');

    if (!isOpen) {
        return null;
    }

    // Format timestamp
    const formattedTimestamp = timestamp 
        ? formatDate(timestamp, 'relative')
        : '';

    // Determine recipient name for vote transfer
    // For vote transaction comments: beneficiaryName is the recipient (from API)
    // For regular comments: no beneficiaryName, so recipient is the author (self-comment)
    const recipientDisplay = beneficiaryName || authorName || '';

    // Check if there are votes from other users
    const hasOtherVotes = (upvotes !== undefined && upvotes > 0) || (downvotes !== undefined && downvotes > 0);

    return (
        <BottomPortal>
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-auto">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                />
                {/* Popup Container */}
                <div className="relative z-10 w-full max-w-md bg-base-100 rounded-t-2xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto">
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

                        {/* Author Information */}
                        {authorName && (
                            <div className="mb-4">
                                <div className="flex items-center gap-3">
                                    <AvatarWithPlaceholder
                                        avatarUrl={authorAvatar}
                                        name={authorName}
                                        size={40}
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">{authorName}</div>
                                        {formattedTimestamp && (
                                            <div className="text-xs opacity-60">{formattedTimestamp}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Community Information */}
                        {communityName && (
                            <div className="mb-4">
                                <div className="flex items-center gap-3">
                                    <CommunityAvatar
                                        avatarUrl={communityAvatar}
                                        communityName={communityName}
                                        size={32}
                                    />
                                    <div className="text-sm font-medium">{communityName}</div>
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        {(authorName || communityName) && (
                            <div className="border-t border-base-300 my-4"></div>
                        )}

                        {/* Beneficiary Information */}
                        {beneficiaryName && beneficiaryName !== authorName && (
                            <div className="mb-4">
                                <div className="text-xs opacity-70 mb-2">{t('beneficiary') || 'Beneficiary'}</div>
                                <div className="flex items-center gap-3">
                                    <AvatarWithPlaceholder
                                        avatarUrl={beneficiaryAvatar}
                                        name={beneficiaryName}
                                        size={32}
                                    />
                                    <div className="text-sm font-medium">{beneficiaryName}</div>
                                </div>
                            </div>
                        )}

                        {/* Comment Content */}
                        {commentContent && (
                            <>
                                <div className="mb-4">
                                    <div className="text-sm whitespace-pre-wrap break-words">{commentContent}</div>
                                </div>
                                <div className="border-t border-base-300 my-4"></div>
                            </>
                        )}

                        {/* Vote Transfer */}
                        {/* Only show vote transfer for vote transaction comments */}
                        {isVoteTransaction && authorName && (
                            <div className="mb-6">
                                <div className="text-sm opacity-70 mb-2">{t('voteTransfer') || 'Vote Transfer'}</div>
                                <div className="bg-base-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium">{authorName}</span>
                                        <span className="text-base opacity-60">→</span>
                                        <span className="text-sm font-medium">{recipientDisplay}</span>
                                    </div>
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
                            </div>
                        )}

                        {/* Breakdown */}
                        {(amountWallet > 0 || amountFree > 0) && (
                            <div className="mb-6">
                                <div className="text-sm opacity-70 mb-2">{t('breakdown') || 'Breakdown'}</div>
                                <div className="bg-base-200 rounded-lg p-4 space-y-3">
                                    {amountWallet > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium">
                                                    {t('fromWallet') || 'From Wallet'}: {isUpvote ? '+' : '-'}{amountWallet}
                                                </span>
                                            </div>
                                            <div className="text-xs opacity-60 ml-6">
                                                {t('walletExplanation') || 'Deducted from voter\'s balance'}
                                            </div>
                                        </div>
                                    )}
                                    {amountFree > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium">
                                                    {t('fromQuota') || 'From Quota'}: {isUpvote ? '+' : '-'}{amountFree}
                                                </span>
                                            </div>
                                            <div className="text-xs opacity-60 ml-6">
                                                {t('quotaExplanation') || 'Used from daily free quota'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Totals on Comment */}
                        {(totalScore !== undefined || totalReceived !== undefined || totalWithdrawn !== undefined) && (
                            <div className="mb-6">
                                <div className="text-sm opacity-70 mb-2">{t('totals') || 'Totals on this comment'}</div>
                                <div className="bg-base-200 rounded-lg p-4 space-y-2">
                                    {totalScore !== undefined && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm opacity-70">{t('totalSum') || 'Total sum'}</span>
                                            <span className="text-sm font-medium">{totalScore}</span>
                                        </div>
                                    )}
                                    {totalReceived !== undefined && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm opacity-70">{t('totalReceived') || 'Total received'}</span>
                                            <span className="text-sm font-medium">{totalReceived}</span>
                                        </div>
                                    )}
                                    {totalWithdrawn !== undefined && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm opacity-70">{t('authorWithdrawn') || 'Author withdrawn'}</span>
                                            <span className="text-sm font-medium">{totalWithdrawn}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Other Users Votes */}
                        {hasOtherVotes && (
                            <div className="mb-6">
                                <div className="text-sm opacity-70 mb-2">
                                    {t('otherUsersVotes') || 'Other users left votes on this vote:'}
                                </div>
                                <div className="bg-base-200 rounded-lg p-4">
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
                                </div>
                            </div>
                        )}

                        {/* Vote Type */}
                        <div className="text-sm opacity-70">
                            {t('voteType') || 'Vote Type'}: {isUpvote ? (t('upvote') || 'Upvote') : (t('downvote') || 'Downvote')}
                        </div>
                    </div>
                </div>
            </div>
        </BottomPortal>
    );
};

