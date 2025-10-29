// Publication voting and withdrawal logic
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useWithdrawFromPublication } from '@/hooks/api/useVotes';

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
  activeWithdrawPost?: string | null;
  setActiveWithdrawPost?: (post: string | null) => void;
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
  activeWithdrawPost,
  setActiveWithdrawPost,
  activeSlider,
  setActiveSlider,
}: UsePublicationVotingProps) {
  const t = useTranslations('feed');
  
  // Withdraw mutation hook
  const withdrawMutation = useWithdrawFromPublication();
  
  // State management
  const [optimisticSum, setOptimisticSum] = useState(sum);
  const [amount, setAmount] = useState(0);
  const [comment, setComment] = useState("");
  const [amountInMerits, setAmountInMerits] = useState(0);
  const [withdrawMerits, setWithdrawMerits] = useState(false);
  
  // Use loading state from mutation
  const loading = withdrawMutation.isPending;
  
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
  const meritsAmount = isAuthor
    ? Math.floor(10 * (withdrawMerits ? effectiveSum : effectiveSum)) / 10
    : 0;
  
  const maxWithdrawAmount = isAuthor
    ? Math.floor(10 * (withdrawMerits ? effectiveSum : effectiveSum)) / 10
    : 0;
  
  const maxTopUpAmount = isAuthor
    ? Math.floor(10 * (withdrawMerits ? currentBalance : currentBalance)) / 10
    : 0;
  
  // Create unique post ID
  const postId = slug || _id;
  
  // Parse active withdrawal state
  const isThisPostActive = activeWithdrawPost && activeWithdrawPost.startsWith(postId + ':');
  const directionAdd = isThisPostActive 
    ? activeWithdrawPost === postId + ':add' 
    : undefined;
  
  // Submit withdrawal - now uses withdraw endpoint instead of vote mutations
  const submitWithdrawal = async () => {
    if (!isAuthor) return;
    
    // Only handle withdrawal (not adding votes through this flow)
    if (directionAdd) {
      // This case (adding votes) should not happen in withdraw flow anymore
      // If needed, it should use the voting popup instead
      console.warn('Adding votes through withdraw flow is deprecated. Use voting popup instead.');
      return;
    }
    
    const withdrawAmount = withdrawMerits ? amountInMerits : amount;
    
    if (withdrawAmount <= 0) {
      return;
    }
    
    const newSum = optimisticSum - withdrawAmount;
    setOptimisticSum(newSum);
    
    // Optimistic wallet update
    if (updateWalletBalance && curr) {
      updateWalletBalance(curr, withdrawAmount);
    }
    
    try {
      // Use withdraw mutation
      await withdrawMutation.mutateAsync({
        publicationId: slug,
        amount: withdrawAmount,
      });
      
      setAmount(0);
      setAmountInMerits(0);
      setComment("");
      
      if (updateAll) await updateAll();
    } catch (error) {
      console.error("Withdrawal failed:", error);
      setOptimisticSum(sum);
      if (updateWalletBalance && curr) {
        updateWalletBalance(curr, -withdrawAmount);
      }
      throw error;
    }
  };
  
  // Handle direction change
  const handleSetDirectionAdd = (direction: boolean | undefined) => {
    if (!setActiveWithdrawPost) return;
    
    if (direction === undefined) {
      setActiveWithdrawPost(null);
      setActiveSlider && setActiveSlider(null);
    } else {
      const newState = postId + ':' + (direction ? 'add' : 'withdraw');
      if (activeWithdrawPost === newState) {
        setActiveWithdrawPost(null);
        setActiveSlider && setActiveSlider(null);
      } else {
        setActiveWithdrawPost(newState);
        setActiveSlider && setActiveSlider(postId || null);
      }
    }
  };
  
  const disabled = withdrawMerits ? !amountInMerits : !amount;
  
  return {
    // State
    optimisticSum,
    effectiveSum,
    amount,
    setAmount,
    comment,
    setComment,
    amountInMerits,
    setAmountInMerits,
    withdrawMerits,
    setWithdrawMerits,
    loading,
    disabled,
    
    // Calculated values
    meritsAmount,
    maxWithdrawAmount,
    maxTopUpAmount,
    currentBalance,
    directionAdd,
    isThisPostActive,
    
    // Actions
    submitWithdrawal,
    handleSetDirectionAdd,
  };
}
