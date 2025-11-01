/**
 * Wallet utility functions
 */

import type { Wallet } from '@/types/api-v1';

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

/**
 * Format balance with proper decimal precision
 * @param balance - Balance amount
 * @param decimalPlaces - Number of decimal places (default: 10)
 * @returns Formatted balance
 */
export function formatWalletBalance(balance: number, decimalPlaces: number = 10): number {
  return Math.floor(Math.pow(10, decimalPlaces) * balance) / Math.pow(10, decimalPlaces);
}

