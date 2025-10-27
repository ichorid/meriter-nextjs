'use client';

import { initDataRaw, useSignal, hapticFeedback } from '@telegram-apps/sdk-react';
import { useTranslations } from 'next-intl';

interface BarVoteUnifiedProps {
    score: number;
    onVoteClick: () => void;
    onWithdrawClick?: () => void;
    isAuthor: boolean;
    isBeneficiary?: boolean;
    commentCount?: number;
    onCommentClick?: () => void;
}

export const BarVoteUnified: React.FC<BarVoteUnifiedProps> = ({ 
    score, 
    onVoteClick, 
    onWithdrawClick,
    isAuthor,
    isBeneficiary = false,
    commentCount = 0,
    onCommentClick
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

    const handleWithdrawClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isInTelegram) {
            hapticFeedback.impactOccurred('soft');
        }
        onWithdrawClick && onWithdrawClick();
    };

    const handleCommentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isInTelegram) {
            hapticFeedback.impactOccurred('light');
        }
        onCommentClick && onCommentClick();
    };

    const canWithdraw = isAuthor && score > 0;
    const canVote = !isAuthor && !isBeneficiary;
    const showDisabledWithdraw = isAuthor && score <= 0;
    const showBeneficiaryWithdraw = isBeneficiary;

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
                
                {canVote && (
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleVoteClick}
                    >
                        {t('vote')}
                    </button>
                )}
                
                {canWithdraw && onWithdrawClick && (
                    <button
                        className="btn btn-outline btn-success btn-sm"
                        onClick={handleWithdrawClick}
                    >
                        {t('withdraw')}
                    </button>
                )}
                
                {(showDisabledWithdraw || showBeneficiaryWithdraw) && (
                    <button
                        className="btn btn-ghost btn-sm"
                        disabled
                        title={score === 0 ? t('noVotesToWithdraw') : undefined}
                    >
                        {t('withdraw')}
                    </button>
                )}
            </div>
        </div>
    );
};


