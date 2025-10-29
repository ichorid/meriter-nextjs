'use client';

import { useTranslations } from 'next-intl';

interface BarWithdrawProps {
    onWithdraw: () => void;
    onTopup: () => void;
    balance: number;
    children: React.ReactNode;
    showDisabled?: boolean; // If true, show disabled button even when balance <= 0
}

export const BarWithdraw: React.FC<BarWithdrawProps> = ({ onWithdraw, onTopup, balance, children, showDisabled = false }) => {
    const t = useTranslations('shared');
    const displayBalance = balance ?? 0;
    
    console.log('[BarWithdraw] Component Logic:', {
      displayBalance,
      showDisabled,
      willShow: showDisabled || (displayBalance > 0),
      isDisabled: displayBalance <= 0,
    });
    
    // If showDisabled is true, always show the button (even if disabled)
    // Otherwise, only show if there's something to withdraw
    if (!showDisabled && (!displayBalance || displayBalance <= 0)) {
        console.log('[BarWithdraw] Returning null - balance <= 0 and showDisabled is false');
        return null;
    }
    
    const isDisabled = displayBalance <= 0;
    
    console.log('[BarWithdraw] Rendering button:', {
      isDisabled,
      displayBalance,
      showDisabled,
    });
    
    return (
        <div className="flex items-center justify-between p-3 border-t border-base-200">
            <div className="left-info">{children}</div>
            <button 
                className={`btn btn-sm gap-2 font-medium transition-all ${
                    isDisabled 
                        ? 'btn-ghost btn-disabled' 
                        : 'btn-outline btn-primary hover:btn-primary'
                }`}
                disabled={isDisabled}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isDisabled) {
                        onWithdraw();
                    }
                }}
                title={isDisabled ? t('noVotesToWithdraw') || 'No votes to withdraw' : undefined}
            >
                {t('withdraw')} <span className="font-bold">{displayBalance}</span>
            </button>
        </div>
    );
};
