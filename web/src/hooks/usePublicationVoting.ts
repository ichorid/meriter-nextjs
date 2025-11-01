// Publication voting and withdrawal logic
import { useState, useEffect } from 'react';
import { getWalletBalance } from '@/lib/utils/wallet';

interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  [key: string]: unknown;
}

export interface UsePublicationVotingProps {
  slug: string;
  _id?: string;
  sum: number;
  isAuthor: boolean;
  authorId?: string;
  myId?: string;
  wallets?: Wallet[];
  communityId: string;
  updateWalletBalance?: (communityId: string, change: number) => void;
  updateAll?: () => Promise<void>;
  activeSlider?: string | null;
  setActiveSlider?: (slider: string | null) => void;
}

export function usePublicationVoting({
  slug,
  _id,
  sum,
  isAuthor,
  authorId,
  myId,
  wallets,
  communityId,
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
  const currentBalance = getWalletBalance(wallets, communityId);
  
  const calculatedSum = optimisticSum ?? sum;
  
  // Calculate withdrawal amounts
  const maxWithdrawAmount = isAuthor
    ? Math.floor(10 * calculatedSum) / 10
    : 0;
  
  const maxTopUpAmount = isAuthor
    ? Math.floor(10 * currentBalance) / 10
    : 0;
  
  return {
    // State
    optimisticSum,
    calculatedSum,
    
    // Calculated values
    maxWithdrawAmount,
    maxTopUpAmount,
    currentBalance,
  };
}
