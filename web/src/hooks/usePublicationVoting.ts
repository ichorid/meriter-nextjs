// Publication voting and withdrawal logic
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useVoteOnPublication, useRemovePublicationVote } from '@/hooks/api/useVotes';

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
  
  // Mutation hooks
  const voteOnPublicationMutation = useVoteOnPublication();
  const removeVoteMutation = useRemovePublicationVote();
  
  // State management
  const [optimisticSum, setOptimisticSum] = useState(sum);
  const [amount, setAmount] = useState(0);
  const [comment, setComment] = useState("");
  const [amountInMerits, setAmountInMerits] = useState(0);
  const [withdrawMerits, setWithdrawMerits] = useState(false);
  
  // Use loading state from mutations
  const loading = voteOnPublicationMutation.isPending || removeVoteMutation.isPending;
  
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
  
  // Submit withdrawal/vote
  const submitWithdrawal = async () => {
    if (!isAuthor) return;
    
    const changeAmount = amount;
    const newSum = directionAdd 
      ? optimisticSum + changeAmount
      : optimisticSum - changeAmount;
    
    setOptimisticSum(newSum);
    
    const walletChange = directionAdd 
      ? -changeAmount
      : changeAmount;
    
    if (updateWalletBalance && curr) {
      updateWalletBalance(curr, walletChange);
    }
    
    try {
      // Use mutation hooks for vote operations
      if (directionAdd) {
        // Adding votes - use vote mutation
        await voteOnPublicationMutation.mutateAsync({
          publicationId: slug,
          data: {
            targetType: 'publication',
            targetId: slug,
            amount: withdrawMerits ? amountInMerits : amount,
            sourceType: withdrawMerits ? 'personal' : 'quota',
          },
          communityId: curr,
        });
      } else {
        // Removing votes - use remove vote mutation
        await removeVoteMutation.mutateAsync(slug);
      }
      
      setAmount(0);
      setAmountInMerits(0);
      setComment("");
      
      if (updateAll) await updateAll();
    } catch (error) {
      console.error("Withdrawal failed:", error);
      setOptimisticSum(sum);
      if (updateWalletBalance && curr) {
        updateWalletBalance(curr, -walletChange);
      }
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
