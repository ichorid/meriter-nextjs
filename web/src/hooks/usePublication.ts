// Publication business logic hook
import { useState, useCallback } from 'react';
import { useCreateTransaction, useVoteOnComment } from '@/hooks/api';
import type { Publication, Wallet } from '@/types/entities';

interface UsePublicationProps {
  publication: Publication;
  wallets?: Wallet[];
  updateWalletBalance?: (currencyOfCommunityTgChatId: string, amountChange: number) => void;
  updateAll?: () => void;
}

export function usePublication({
  publication,
  wallets = [],
  updateWalletBalance,
  updateAll,
}: UsePublicationProps) {
  const [activeCommentHook, setActiveCommentHook] = useState<string | null>(null);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

  const createTransactionMutation = useCreateTransaction();
  const voteOnCommentMutation = useVoteOnComment();

  const handleVote = useCallback(async (direction: 'plus' | 'minus', amount: number = 1) => {
    if (!publication.uid) return;

    try {
      await createTransactionMutation.mutateAsync({
        amountPoints: amount,
        comment: '',
        directionPlus: direction === 'plus',
        forPublicationSlug: publication.slug,
        inPublicationSlug: publication.slug,
        publicationSlug: publication.slug,
      });

      // Update wallet balance optimistically
      if (updateWalletBalance && publication.meta.origin.telegramChatId) {
        const change = direction === 'plus' ? amount : -amount;
        updateWalletBalance(publication.meta.origin.telegramChatId, change);
      }

      // Refresh data
      if (updateAll) {
        updateAll();
      }
    } catch (error) {
      console.error('Vote error:', error);
    }
  }, [publication, createTransactionMutation, updateWalletBalance, updateAll]);

  const handleComment = useCallback(async (comment: string, amount: number, directionPlus: boolean) => {
    if (!publication.uid) return;

    try {
      await voteOnCommentMutation.mutateAsync({
        amountPoints: amount,
        comment,
        directionPlus,
        forPublicationSlug: publication.slug,
        inPublicationSlug: publication.slug,
      });

      // Update wallet balance optimistically
      if (updateWalletBalance && publication.meta.origin.telegramChatId) {
        const change = directionPlus ? amount : -amount;
        updateWalletBalance(publication.meta.origin.telegramChatId, change);
      }

      // Refresh data
      if (updateAll) {
        updateAll();
      }

      // Close comment form
      setActiveCommentHook(null);
    } catch (error) {
      console.error('Comment error:', error);
    }
  }, [publication, voteOnCommentMutation, updateWalletBalance, updateAll]);

  const handleWithdraw = useCallback((postId: string | null) => {
    setActiveWithdrawPost(postId);
  }, []);

  const handleSliderToggle = useCallback((sliderId: string | null) => {
    setActiveSlider(sliderId);
  }, []);

  const handleCommentToggle = useCallback((commentId: string | null) => {
    setActiveCommentHook(commentId);
  }, []);

  // Get current wallet balance for this publication's community
  const getCurrentBalance = useCallback(() => {
    if (!publication.meta.origin.telegramChatId) return 0;
    return wallets.find(w => w.meta.currencyOfCommunityTgChatId === publication.meta.origin.telegramChatId)?.value || 0;
  }, [wallets, publication.meta.origin.telegramChatId]);

  return {
    // State
    activeCommentHook: [activeCommentHook, handleCommentToggle] as const,
    activeSlider,
    setActiveSlider: handleSliderToggle,
    activeWithdrawPost,
    setActiveWithdrawPost: handleWithdraw,
    
    // Actions
    handleVote,
    handleComment,
    
    // Computed values
    currentBalance: getCurrentBalance(),
    
    // Loading states
    isVoting: createTransactionMutation.isPending,
    isCommenting: voteOnCommentMutation.isPending,
  };
}

