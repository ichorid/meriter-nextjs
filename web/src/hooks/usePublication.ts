// Publication business logic hook
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVoteOnPublication, useVoteOnComment } from '@/hooks/api';
import { useCreateComment } from '@/hooks/api/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { walletKeys } from '@/hooks/api/useWallet';

// Local type definitions
interface Publication {
  id: string;
  title: string;
  content: string;
  authorId: string;
  communityId: string;
  type: 'text' | 'image' | 'video' | 'poll';
  imageUrl?: string;
  videoUrl?: string;
  hashtags?: string[];
  createdAt: string;
  updatedAt: string;
  metrics?: {
    score: number;
    commentCount: number;
  };
}

interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  currencyOfCommunityTgChatId?: string;
  amount?: number;
}

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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeCommentHook, setActiveCommentHook] = useState<string | null>(null);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

  const voteOnPublicationMutation = useVoteOnPublication();
  const voteOnCommentMutation = useVoteOnComment();
  const createCommentMutation = useCreateComment();

  const handleVote = useCallback(async (direction: 'plus' | 'minus', amount: number = 1) => {
    if (!publication.id) return;

    try {
      const sourceType: 'personal' | 'quota' = 'quota'; // Use quota first for voting
      
      // Optimistically update quota if using quota
      if (sourceType === 'quota' && publication.communityId && user?.id) {
        const quotaQueryKey = ['user-quota', user.id, publication.communityId];
        queryClient.setQueryData(quotaQueryKey, (oldQuota: any) => {
          if (!oldQuota || typeof oldQuota.remainingToday !== 'number') {
            return oldQuota;
          }
          const newRemainingToday = Math.max(0, oldQuota.remainingToday - amount);
          const newUsedToday = (oldQuota.usedToday || 0) + amount;
          return {
            ...oldQuota,
            remainingToday: newRemainingToday,
            usedToday: newUsedToday,
          };
        });
      }

      // Note: Wallet balance updates for 'personal' sourceType are handled via updateWalletBalance callback
      // if needed in the future

      await voteOnPublicationMutation.mutateAsync({
        publicationId: publication.id,
        data: {
          targetType: 'publication',
          targetId: publication.id,
          amount,
          sourceType,
        },
      });

      // Refresh data
      if (updateAll) {
        updateAll();
      }
    } catch (error) {
      console.error('Vote error:', error);
    }
  }, [publication, voteOnPublicationMutation, updateWalletBalance, updateAll, queryClient, user, wallets]);

  const handleComment = useCallback(async (comment: string, amount: number, directionPlus: boolean) => {
    if (!publication.id) return;

    try {
      let commentId: string | undefined = undefined;
      
      // Create comment if provided
      if (comment.trim()) {
        const commentResult = await createCommentMutation.mutateAsync({
          targetType: 'publication',
          targetId: publication.id,
          content: comment.trim(),
        });
        commentId = commentResult.id;
      }

      // Determine sourceType: use quota if available, otherwise use personal wallet
      // For now, prioritize quota for voting - user should use quota first
      // We'll always use 'quota' for now if the user has quota available
      // The backend should handle determining if quota is available
      // Actually, for simplicity, we'll use 'personal' and let the backend decide based on available balance
      // But for quota tracking, we need to explicitly mark quota votes
      // Let's use 'quota' by default since users typically vote with their daily quota first
      const sourceType: 'personal' | 'quota' = 'quota'; // Use quota first for voting

      // Optimistically update quota if using quota
      if (sourceType === 'quota' && publication.communityId && user?.id) {
        const quotaQueryKey = ['user-quota', user.id, publication.communityId];
        queryClient.setQueryData(quotaQueryKey, (oldQuota: any) => {
          if (!oldQuota || typeof oldQuota.remainingToday !== 'number') {
            // If no cached quota, skip optimistic update (will be fetched after mutation)
            return oldQuota;
          }
          // Decrement remainingToday by the absolute vote amount (quota is used regardless of up/down)
          const voteAmountUsed = Math.abs(amount);
          const newRemainingToday = Math.max(0, oldQuota.remainingToday - voteAmountUsed);
          const newUsedToday = (oldQuota.usedToday || 0) + voteAmountUsed;
          return {
            ...oldQuota,
            remainingToday: newRemainingToday,
            usedToday: newUsedToday,
          };
        });
      }

      // Note: Wallet balance updates for 'personal' sourceType are handled via updateWalletBalance callback
      // Currently using 'quota' sourceType, so wallet updates are not needed here

      // Create vote (with optional comment ID)
      // amount can be negative for downvotes - pass it as-is
      // The backend will determine direction from amount > 0
      const voteResult = await voteOnPublicationMutation.mutateAsync({
        publicationId: publication.id,
        data: {
          targetType: 'publication',
          targetId: publication.id,
          amount: amount, // Can be negative for downvotes
          sourceType,
          attachedCommentId: commentId,
        },
      });

      // Refresh data immediately to update UI (this will also refresh quota/wallet from server)
      if (updateAll) {
        updateAll();
      }

      // Close comment form
      setActiveCommentHook(null);
    } catch (error: any) {
      console.error('Comment error:', error);
      // Re-throw to allow component to display error
      throw error;
    }
  }, [publication, voteOnPublicationMutation, createCommentMutation, updateWalletBalance, updateAll]);

  const handleWithdraw = useCallback((postId: string | null) => {
    setActiveWithdrawPost(postId);
  }, []);

  const handleSliderToggle = useCallback((sliderId: string | null) => {
    setActiveSlider(sliderId);
  }, []);

  const handleCommentToggle = useCallback((commentId: string | null) => {
    console.log('🔄 handleCommentToggle called in usePublication:', { commentId, currentValue: activeCommentHook });
    setActiveCommentHook(commentId);
    console.log('🔄 After setActiveCommentHook, state should update in next render');
  }, [activeCommentHook]);

  // Get current wallet balance for this publication's community
  const getCurrentBalance = useCallback(() => {
    if (!publication.communityId) return 0;
    return wallets.find(w => w.communityId === publication.communityId)?.balance || 0;
  }, [wallets, publication.communityId]);

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
    isVoting: voteOnPublicationMutation.isPending,
    isCommenting: voteOnPublicationMutation.isPending,
  };
}

