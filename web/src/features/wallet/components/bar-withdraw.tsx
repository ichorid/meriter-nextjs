'use client';

import { useTranslations } from 'next-intl';

export const BarWithdraw = ({ onWithdraw, onTopup, balance, children }) => {
    const t = useTranslations('shared');
    const displayBalance = balance ?? 0;
    
    // Don't show withdraw bar if there's nothing to withdraw
    if (!displayBalance || displayBalance <= 0) {
        return null;
    }
    
    return (
        <div className="flex items-center justify-between p-3 border-t border-base-200">
            <div className="left-info">{children}</div>
            <button 
                className="btn btn-sm btn-outline btn-primary gap-2 font-medium hover:btn-primary transition-all"
                onClick={(e) => {
                    e.stopPropagation();
                    onWithdraw();
                }}
            >
                {t('withdraw')} <span className="font-bold">{displayBalance}</span>
            </button>
        </div>
    );
};
