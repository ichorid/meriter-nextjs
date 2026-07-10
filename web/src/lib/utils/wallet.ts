/**
 * Wallet utility functions
 */

import type { Wallet } from '@/types/api-v1';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { isPriorityCommunity } from '@/lib/community/is-priority-community';

/**
 * Wallet-like interface for partial wallet objects
 */
interface WalletLike {
  id?: string;
  userId?: string;
  communityId: string;
  balance: number;
}

/**
 * Union type that accepts both full Wallet and partial WalletLike
 */
type WalletOrLike = Wallet | WalletLike;

/**
 * Get wallet balance for a specific community
 * @param wallets - Array of wallets (can be full Wallet or partial WalletLike)
 * @param communityId - Community ID to find balance for
 * @returns Balance amount or 0 if not found
 */
export function getWalletBalance(wallets: WalletOrLike[] | undefined, communityId: string | undefined): number {
  if (!wallets || !Array.isArray(wallets) || !communityId) {
    return 0;
  }
  
  const wallet = wallets.find(w => w.communityId === communityId);
  return wallet?.balance || 0;
}

/**
 * Get wallet for a specific community
 * @param wallets - Array of wallets
 * @param communityId - Community ID to find wallet for
 * @returns Wallet object or undefined if not found
 */
export function getWallet(wallets: Wallet[] | undefined, communityId: string | undefined): Wallet | undefined {
  if (!wallets || !Array.isArray(wallets) || !communityId) {
    return undefined;
  }
  
  return wallets.find(w => w.communityId === communityId);
}

type CommunityWalletLookup = {
  id: string;
  typeTag?: string | null;
  isPriority?: boolean | null;
  isProject?: boolean | null;
};

/**
 * Sidebar / list cards: priority hubs and projects debit the global personal wallet (G-11).
 */
export function resolvePersonalWalletFromMap(
  walletsMap: Map<string, WalletOrLike>,
  community: CommunityWalletLookup,
): { balance: number; communityId: string } | undefined {
  const useGlobalWallet =
    isPriorityCommunity(community) || community.isProject === true;

  if (useGlobalWallet) {
    const global = walletsMap.get(GLOBAL_COMMUNITY_ID);
    if (!global) return undefined;
    return { balance: global.balance || 0, communityId: community.id };
  }

  const wallet = walletsMap.get(community.id);
  if (!wallet) return undefined;
  return { balance: wallet.balance || 0, communityId: community.id };
}

/**
 * Format balance with proper decimal precision
 * @param balance - Balance amount
 * @param decimalPlaces - Number of decimal places (default: 10)
 * @returns Formatted balance
 */
export function formatWalletBalance(balance: number, decimalPlaces: number = 10): number {
  return Math.floor(Math.pow(10, decimalPlaces) * balance) / Math.pow(10, decimalPlaces);
}

