'use client';

import React, { useEffect } from 'react';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { useWallet } from '@/hooks/api/useWallet';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useCommunity } from '@/hooks/api';
import { POLLING } from '@/lib/constants';

export interface EnergyWalletChipProps {
    communityId: string;
    onClick?: () => void;
    className?: string;
    layoutMode?: 'inline' | 'badge' | 'compact';
    flashTrigger?: number;
    variant?: 'default' | 'golden';
    inverted?: boolean;
}

/**
 * Unified Energy-Wallet component that organically combines:
 * - Daily energy quota (DailyQuotaRing)
 * - Wallet balance
 * 
 * Auto-refreshes every 30 seconds to keep data current.
 */
export const EnergyWalletChip: React.FC<EnergyWalletChipProps> = ({
    communityId,
    onClick,
    className = '',
    layoutMode = 'inline',
    flashTrigger,
    variant = 'default',
    inverted = false,
}) => {
    // Fetch wallet data with auto-refresh
    const { data: wallet, refetch: refetchWallet } = useWallet(communityId);

    // Fetch quota data with auto-refresh
    const { data: quotaData, refetch: refetchQuota } = useUserQuota(communityId);

    // Fetch community data for currency icon
    const { data: community, refetch: refetchCommunity } = useCommunity(communityId);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            refetchWallet();
            refetchQuota();
            refetchCommunity();
        }, POLLING.WALLET_ENERGY);

        return () => clearInterval(interval);
    }, [refetchWallet, refetchQuota, refetchCommunity]);

    // Extract data
    const balance = wallet?.balance ?? 0;
    const currencyIconUrl = community?.settings?.iconUrl;
    const quotaRemaining = quotaData?.remainingToday ?? 0;
    const quotaMax = quotaData?.dailyQuota ?? 0;

    // Render based on layout mode
    const renderContent = () => {
        switch (layoutMode) {
            case 'badge':
                return (
                    <div className="relative">
                        <DailyQuotaRing
                            remaining={quotaRemaining}
                            max={quotaMax}
                            onClick={onClick}
                            className="w-[30px] h-[30px]"
                            asDiv={!onClick}
                            flashTrigger={flashTrigger}
                            variant={variant}
                            inverted={inverted}
                        />
                        {/* Balance badge positioned at top-right */}
                        <div className="absolute -top-1 -right-1 bg-base-100 shadow-none rounded-full px-1.5 py-0.5 shadow-sm flex items-center gap-0.5 min-w-[28px] justify-center">
                            {currencyIconUrl && (
                                <img
                                    src={currencyIconUrl}
                                    alt="Currency"
                                    className="w-2.5 h-2.5 flex-shrink-0"
                                />
                            )}
                            <span className="text-[9px] font-semibold text-base-content leading-none">
                                {balance}
                            </span>
                        </div>
                    </div>
                );

            case 'compact':
                return (
                    <div className="flex items-center gap-1">
                        <DailyQuotaRing
                            remaining={quotaRemaining}
                            max={quotaMax}
                            onClick={onClick}
                            className="w-[26px] h-[26px]"
                            asDiv={!onClick}
                            flashTrigger={flashTrigger}
                            variant={variant}
                            inverted={inverted}
                        />
                        {/* Compact balance display */}
                        <div className="flex items-center gap-0.5">
                            {currencyIconUrl && (
                                <img
                                    src={currencyIconUrl}
                                    alt="Currency"
                                    className="w-2.5 h-2.5 flex-shrink-0 opacity-70"
                                />
                            )}
                            <span className="text-[10px] font-semibold text-base-content/70 leading-none">
                                {balance}
                            </span>
                        </div>
                    </div>
                );

            case 'inline':
            default:
                return (
                    <div className="flex items-center gap-2">
                        <DailyQuotaRing
                            remaining={quotaRemaining}
                            max={quotaMax}
                            onClick={onClick}
                            className="w-[30px] h-[30px]"
                            asDiv={!onClick}
                            flashTrigger={flashTrigger}
                            variant={variant}
                            inverted={inverted}
                        />
                        {/* Balance display beside ring */}
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-base-100/50 rounded-md shadow-none">
                            {currencyIconUrl && (
                                <img
                                    src={currencyIconUrl}
                                    alt="Currency"
                                    className="w-3 h-3 flex-shrink-0"
                                />
                            )}
                            <span className="text-xs font-semibold text-base-content">
                                {balance}
                            </span>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className={`energy-wallet-chip ${className}`}>
            {renderContent()}
        </div>
    );
};
