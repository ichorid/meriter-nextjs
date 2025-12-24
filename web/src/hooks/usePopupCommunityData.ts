import { useMemo } from 'react';
import { useWallets, useCommunity } from '@/hooks/api';

/**
 * Shared hook for popup components to get community-related data
 * Handles wallet lookup, community data fetching, and currency icon retrieval
 */
export function usePopupCommunityData(communityId?: string) {
  // Get wallets to find balance for the target community
  const { data: wallets = [] } = useWallets();
  
  // Determine which community to use - prefer prop, otherwise try to derive from target
  const targetCommunityId = communityId || (wallets[0]?.communityId);

  // Get community data to access currency icon
  const { data: communityData } = useCommunity(targetCommunityId || '');
  const currencyIconUrl = communityData?.settings?.iconUrl;

  // Get wallet balance for the community
  const walletBalance = useMemo(() => {
    if (!targetCommunityId || !Array.isArray(wallets)) return 0;
    const wallet = wallets.find((w: unknown) => w.communityId === targetCommunityId);
    return wallet?.balance || 0;
  }, [targetCommunityId, wallets]);

  return {
    targetCommunityId,
    currencyIconUrl,
    walletBalance,
    wallets,
  };
}

