'use client';

import { useTranslations } from 'next-intl';
import { hapticImpact } from '@shared/lib/utils/haptic-utils';

interface BarWithdrawProps {
    onWithdraw: () => void;
    onTopup: () => void;
    balance: number;
    children?: React.ReactNode;
    showDisabled?: boolean; // If true, show disabled button even when balance <= 0
    isLoading?: boolean; // If true, show loading state
    commentCount?: number;
    onCommentClick?: () => void;
}

export const BarWithdraw: React.FC<BarWithdrawProps> = ({ 
    onWithdraw, 
    onTopup, 
    balance, 
    children, 
    showDisabled = false, 
    isLoading = false,
    commentCount = 0,
    onCommentClick
}) => {
    const t = useTranslations('shared');
    // Handle NaN, null, and undefined values
    const displayBalance = (typeof balance === 'number' && !isNaN(balance)) ? balance : 0;
    
    // If showDisabled is true, always show the button (even if disabled)
    // Otherwise, only show if there's something to withdraw
    if (!showDisabled && (!displayBalance || displayBalance <= 0)) {
        return null;
    }
    
    const isDisabled = displayBalance <= 0 || isLoading;

    const handleCommentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        hapticImpact('light');
        onCommentClick && onCommentClick();
    };
    
    return (
        <div className="grid grid-cols-[1fr_140px] gap-4 px-5 py-2.5">
            <div className="flex items-center gap-2 mt-4">
                {children && <div className="left-info">{children}</div>}
                {commentCount > 0 && (
                    <div className="cursor-pointer flex items-center gap-2" onClick={handleCommentClick}>
                        <img className="w-6 h-6 opacity-30" src={"/meriter/comment.svg"} alt="Comments" />
                        <span className="text-sm opacity-50">{commentCount}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-3 mt-4">
                <button 
                    className={`btn-action h-9 px-4 text-xs gap-2 ${
                        isDisabled 
                            ? 'btn-ghost' 
                            : 'btn-action-outline'
                    }`}
                    disabled={isDisabled}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isDisabled) {
                            onWithdraw();
                        }
                    }}
                    title={isDisabled ? (isLoading ? 'Withdrawing...' : (t('noVotesToWithdraw') || 'No votes to withdraw')) : undefined}
                >
                    {isLoading ? (
                        <>
                            <span className="loading loading-spinner loading-xs"></span>
                            {t('withdraw')} <span className="font-bold">{displayBalance}</span>
                        </>
                    ) : (
                        <>
                            {t('withdraw')} <span className="font-bold">{displayBalance}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
