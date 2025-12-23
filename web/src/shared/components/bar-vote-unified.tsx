'use client';

import { useTranslations } from 'next-intl';
import { hapticImpact } from '@shared/lib/utils/haptic-utils';
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
    totalVotes?: number; // Total votes including withdrawn (only shown when > score)
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
    slug,
    totalVotes
}) => {
    const t = useTranslations('shared');
    
    // Calculate canVote first (needed for tooltip)
    const mutualExclusivityCheck = (!isAuthor && !isBeneficiary) || (isAuthor && hasBeneficiary);
    const canVote = canVoteProp !== undefined 
      ? canVoteProp
      : mutualExclusivityCheck;
    
    // Get tooltip text for disabled vote button
    const getTooltipText = (): string | undefined => {
        if (canVote) {
            return undefined;
        }
        if (disabledReason) {
            // Try to get translation, fallback to default if not found
            try {
                const translated = t(disabledReason);
                // If translation returns the key itself, it means translation is missing
                if (translated === disabledReason) {
                    return t('voteDisabled.default');
                }
                return translated;
            } catch {
                return t('voteDisabled.default');
            }
        }
        return t('voteDisabled.default');
    };
    
    const tooltipText = getTooltipText();
    
    const handleVoteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canVote) {
            return;
        }
        hapticImpact('soft');
        onVoteClick();
    };

    const handleCommentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        hapticImpact('light');
        onCommentClick && onCommentClick();
    };

    const handleShareClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        hapticImpact('light');
        if (communityId && slug) {
            const url = getPostUrl(communityId, slug);
            await shareUrl(url, t('urlCopiedToBuffer'));
        }
    };

    
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
                <div className="flex items-center gap-2">
                    <span className={`text-lg font-semibold tabular-nums ${
                        score > 0 ? "text-success" : score < 0 ? "text-error" : "text-base-content/40"
                    }`}>
                        {score > 0 ? '+' : ''}{score}
                    </span>
                    {totalVotes !== undefined && 
                     typeof totalVotes === 'number' && 
                     !Number.isNaN(totalVotes) &&
                     typeof score === 'number' && 
                     !Number.isNaN(score) &&
                     totalVotes > score && (
                        <span 
                            className="text-base-content/40 text-sm font-medium tabular-nums"
                            title={t('totalVotesTooltip')}
                        >
                            ({totalVotes > 0 ? '+' : ''}{totalVotes})
                        </span>
                    )}
                </div>
                
                <button
                    className={`h-8 px-4 text-xs font-medium rounded-lg transition-all ${
                        !canVote 
                            ? 'bg-base-content/5 text-base-content/30 cursor-not-allowed' 
                            : 'bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95'
                    }`}
                    onClick={handleVoteClick}
                    disabled={!canVote}
                    title={tooltipText}
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


