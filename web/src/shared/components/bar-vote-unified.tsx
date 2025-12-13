'use client';

import { initDataRaw, useSignal, hapticFeedback } from '@telegram-apps/sdk-react';
import { useTranslations } from 'next-intl';
import { shareUrl, getPostUrl } from '../lib/share-utils';

interface BarVoteUnifiedProps {
    score: number;
    onVoteClick: () => void;
    isAuthor: boolean;
    isBeneficiary?: boolean;
    hasBeneficiary?: boolean; // Whether the object has a beneficiary (different from author)
    commentCount?: number;
    onCommentClick?: () => void;
    canVote?: boolean; // Whether user has permission to vote based on community rules
    disabledReason?: string; // Translation key for why voting is disabled
    communityId?: string; // Community ID for share functionality
    slug?: string; // Post slug for share functionality
}

export const BarVoteUnified: React.FC<BarVoteUnifiedProps> = ({ 
    score, 
    onVoteClick, 
    isAuthor,
    isBeneficiary = false,
    hasBeneficiary = false,
    commentCount = 0,
    onCommentClick,
    canVote: canVoteProp,
    disabledReason,
    communityId,
    slug
}) => {
    const t = useTranslations('shared');
    const rawData = useSignal(initDataRaw);
    const isInTelegram = !!rawData;
    
    const handleVoteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isInTelegram) {
            hapticFeedback.impactOccurred('soft');
        }
        onVoteClick();
    };

    const handleCommentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isInTelegram) {
            hapticFeedback.impactOccurred('light');
        }
        onCommentClick && onCommentClick();
    };

    const handleShareClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isInTelegram) {
            hapticFeedback.impactOccurred('light');
        }
        if (communityId && slug) {
            const url = getPostUrl(communityId, slug);
            await shareUrl(url, t('urlCopiedToBuffer'));
        }
    };

    // Mutual exclusivity: Vote and Withdraw are mutually exclusive
    // Can vote if: (NOT author AND NOT beneficiary) OR (IS author AND has beneficiary)
    // IMPORTANT: Never show vote button if user is beneficiary, regardless of other conditions
    // Exception: If canVoteProp is explicitly provided (from useCanVote hook), it already handles
    // all edge cases including future-vision group self-voting exceptions, so we trust it.
    const mutualExclusivityCheck = (!isAuthor && !isBeneficiary) || (isAuthor && hasBeneficiary);
    
    // Combine mutual exclusivity check with permission check (community rules, roles, etc.)
    // If canVoteProp is explicitly provided (true/false), trust it as it handles all exceptions
    // If canVoteProp is undefined, fall back to mutual exclusivity check only (backward compatibility)
    const canVote = canVoteProp !== undefined 
      ? canVoteProp  // Trust the permission system (handles future-vision exceptions, etc.)
      : mutualExclusivityCheck; // Fallback for backward compatibility
    
    // Cannot show withdraw button here - withdraw should be handled by separate BarWithdraw component
    // This component always shows the vote button and score counter, but disables the button when user cannot vote

    return (
        <div className="flex items-center justify-between pt-3 border-t border-base-content/5">
            {/* Comments */}
            <div className="flex items-center gap-4">
                {commentCount > 0 && (
                    <button 
                        className="flex items-center gap-1.5 text-base-content/40 hover:text-base-content/60 transition-colors"
                        onClick={handleCommentClick}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span className="text-xs font-medium">{commentCount}</span>
                    </button>
                )}
            </div>
            
            {/* Score & Vote & Share */}
            <div className="flex items-center gap-3">
                <span className={`text-lg font-semibold tabular-nums ${
                    score > 0 ? "text-success" : score < 0 ? "text-error" : "text-base-content/40"
                }`}>
                    {score > 0 ? '+' : ''}{score}
                </span>
                
                <button
                    className={`h-8 px-4 text-xs font-medium rounded-lg transition-all ${
                        !canVote 
                            ? 'bg-base-content/5 text-base-content/30 cursor-not-allowed' 
                            : 'bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95'
                    }`}
                    onClick={handleVoteClick}
                    disabled={!canVote}
                    title={!canVote ? (disabledReason ? t(disabledReason) : t('voteDisabled.default')) : undefined}
                >
                    {t('vote')}
                </button>

                {communityId && slug && (
                    <button
                        className="flex items-center justify-center h-8 w-8 text-base-content/40 hover:text-base-content/60 transition-colors"
                        onClick={handleShareClick}
                        title={t('share')}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};


