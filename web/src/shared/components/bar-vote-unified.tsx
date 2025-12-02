'use client';

import { initDataRaw, useSignal, hapticFeedback } from '@telegram-apps/sdk-react';
import { useTranslations } from 'next-intl';

interface BarVoteUnifiedProps {
    score: number;
    onVoteClick: () => void;
    isAuthor: boolean;
    isBeneficiary?: boolean;
    hasBeneficiary?: boolean; // Whether the object has a beneficiary (different from author)
    commentCount?: number;
    onCommentClick?: () => void;
    canVote?: boolean; // Whether user has permission to vote based on community rules
}

export const BarVoteUnified: React.FC<BarVoteUnifiedProps> = ({ 
    score, 
    onVoteClick, 
    isAuthor,
    isBeneficiary = false,
    hasBeneficiary = false,
    commentCount = 0,
    onCommentClick,
    canVote: canVoteProp
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

    // Mutual exclusivity: Vote and Withdraw are mutually exclusive
    // Can vote if: (NOT author AND NOT beneficiary) OR (IS author AND has beneficiary)
    // IMPORTANT: Never show vote button if user is beneficiary, regardless of other conditions
    const mutualExclusivityCheck = (!isAuthor && !isBeneficiary) || (isAuthor && hasBeneficiary);
    
    // Combine mutual exclusivity check with permission check (community rules, roles, etc.)
    // If canVoteProp is undefined, fall back to mutual exclusivity check only (backward compatibility)
    const canVote = mutualExclusivityCheck && (canVoteProp !== undefined ? canVoteProp : true);
    
    // Cannot show withdraw button here - withdraw should be handled by separate BarWithdraw component
    // This component only shows vote button when appropriate

    return (
        <div className="grid grid-cols-[1fr_140px] gap-4 px-5 py-2.5">
            {commentCount > 0 && (
                <div className="flex items-center gap-2 mt-4">
                    <div className="cursor-pointer flex items-center gap-2" onClick={handleCommentClick}>
                        <img className="w-6 h-6 opacity-30" src={"/meriter/comment.svg"} alt="Comments" />
                        <span className="text-sm opacity-50">{commentCount}</span>
                    </div>
                </div>
            )}
            
            <div className="flex items-center gap-3 mt-4">
                <div className={`text-2xl font-bold ${score > 0 ? "text-success" : score < 0 ? "text-error" : "text-secondary"}`}>
                    {score}
                </div>
                
                {mutualExclusivityCheck && (
                    <button
                        className={`btn-action h-9 px-4 text-xs gap-2 ${
                            !canVote 
                                ? 'btn-ghost' 
                                : 'btn-action-outline'
                        }`}
                        onClick={handleVoteClick}
                        disabled={!canVote}
                        title={!canVote ? 'You do not have permission to vote on this content' : undefined}
                    >
                        {t('vote')}
                    </button>
                )}
            </div>
        </div>
    );
};


