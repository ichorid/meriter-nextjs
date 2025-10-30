// Publication voting and withdrawal logic
import { useState, useEffect } from 'react';

interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  currencyOfCommunityTgChatId?: string;
  [key: string]: unknown;
}

export interface UsePublicationVotingProps {
  slug: string;
  _id?: string;
  sum: number;
  isAuthor: boolean;
  tgAuthorId?: string;
  myId?: string;
  wallets?: Wallet[];
  currencyOfCommunityTgChatId?: string;
  fromTgChatId?: string;
  tgChatId?: string;
  updateWalletBalance?: (currency: string, change: number) => void;
  updateAll?: () => Promise<void>;
  activeSlider?: string | null;
  setActiveSlider?: (slider: string | null) => void;
}

export function usePublicationVoting({
  slug,
  _id,
  sum,
  isAuthor,
  tgAuthorId,
  myId,
  wallets,
  currencyOfCommunityTgChatId,
  fromTgChatId,
  tgChatId,
  updateWalletBalance,
  updateAll,
  activeSlider,
  setActiveSlider,
}: UsePublicationVotingProps) {
  // State management for optimistic updates
  const [optimisticSum, setOptimisticSum] = useState(sum);
  
  // Update optimistic sum when sum changes
  useEffect(() => {
    setOptimisticSum(sum);
  }, [sum]);
  
  // Calculate current balance
  const curr = currencyOfCommunityTgChatId || fromTgChatId || tgChatId;
  const currentBalance = (Array.isArray(wallets) &&
    wallets.find((w) => w.currencyOfCommunityTgChatId == curr)?.balance) || 0;
  
  const effectiveSum = optimisticSum ?? sum;
  
  // Calculate withdrawal amounts
  const maxWithdrawAmount = isAuthor
    ? Math.floor(10 * effectiveSum) / 10
    : 0;
  
  const maxTopUpAmount = isAuthor
    ? Math.floor(10 * currentBalance) / 10
    : 0;
  
  return {
    // State
    optimisticSum,
    effectiveSum,
    
    // Calculated values
    maxWithdrawAmount,
    maxTopUpAmount,
    currentBalance,
  };
}
