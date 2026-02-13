import { useWallets, useCommunity, useWalletBalance } from '@/hooks/api';

/**
 * Shared hook for popup components to get community-related data
 * Handles wallet lookup, community data fetching, and currency icon retrieval
 *
 * G-13: For priority communities, backend returns global wallet/balance.
 * useWalletBalance(communityId) resolves to global balance when community is priority.
 */
export function usePopupCommunityData(communityId?: string) {
  const { data: wallets = [] } = useWallets();

  // Determine which community to use - prefer prop, otherwise derive from wallets
  const targetCommunityId = communityId || (wallets[0]?.communityId);

  // Get community data to access currency icon
  const { data: communityData } = useCommunity(targetCommunityId || '');
  const currencyIconUrl = communityData?.settings?.iconUrl;

  // G-13: Use getBalance API — backend returns global balance for priority communities
  const { data: walletBalance = 0 } = useWalletBalance(targetCommunityId || undefined);

  return {
    targetCommunityId,
    currencyIconUrl,
    walletBalance: typeof walletBalance === 'number' ? walletBalance : 0,
    wallets,
  };
}

