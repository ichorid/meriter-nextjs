import { useMemo } from 'react';
import { useWallets } from '@/hooks/api/useWallet';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';

/**
 * Hook to calculate user's total merits balance (permanent and daily quota)
 *
 * G-13: Backend returns one global wallet for priority communities (MD, OB, Projects, Support).
 * Summing wallets no longer duplicates MD+OB — single global balance.
 *
 * @returns Object containing:
 *   - totalWalletBalance: total permanent merits across all wallets
 *   - totalDailyQuota: total daily merits quota across all communities
 *   - communityIds: array of unique community IDs from wallets
 *   - quotasMap: map of community IDs to their quota data
 *   - wallets: array of user's wallets
 *   - walletsLoading: loading state for wallets
 */
export function useUserMeritsBalance() {
  // Get wallets and calculate total balance (permanent merits)
  const { data: wallets = [], isLoading: walletsLoading } = useWallets();
  
  // Calculate total wallet balance (permanent merits)
  const totalWalletBalance = useMemo(() => {
    return wallets.reduce((sum, wallet) => sum + (wallet.balance || 0), 0);
  }, [wallets]);
  
  // Get unique community IDs from wallets
  const communityIds = useMemo(() => {
    return Array.from(new Set(
      wallets
        .filter((w: any) => w?.communityId)
        .map((w: any) => w.communityId)
    ));
  }, [wallets]);
  
  // Fetch quotas for all communities in parallel
  const { quotasMap } = useCommunityQuotas(communityIds);
  
  // Calculate total daily quota (daily merits)
  const totalDailyQuota = useMemo(() => {
    let total = 0;
    quotasMap.forEach((quota) => {
      total += quota.remainingToday || 0;
    });
    return total;
  }, [quotasMap]);

  return {
    totalWalletBalance,
    totalDailyQuota,
    communityIds,
    quotasMap,
    wallets,
    walletsLoading,
  };
}

