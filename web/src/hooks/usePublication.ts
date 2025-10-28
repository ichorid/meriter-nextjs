// Publication business logic hook
import { useState, useCallback } from 'react';
import { useVoteOnPublication, useVoteOnComment } from '@/hooks/api';

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
  const [activeCommentHook, setActiveCommentHook] = useState<string | null>(null);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);

  const voteOnPublicationMutation = useVoteOnPublication();
  const voteOnCommentMutation = useVoteOnComment();

  const handleVote = useCallback(async (direction: 'plus' | 'minus', amount: number = 1) => {
    if (!publication.id) return;

    try {
      await voteOnPublicationMutation.mutateAsync({
        publicationId: publication.id,
        data: {
          targetType: 'publication',
          targetId: publication.id,
          amount,
          sourceType: 'personal',
        },
      });

      // Update wallet balance optimistically
      if (updateWalletBalance && publication.communityId) {
        const change = direction === 'plus' ? amount : -amount;
        updateWalletBalance(publication.communityId, change);
      }

      // Refresh data
      if (updateAll) {
        updateAll();
      }
    } catch (error) {
      console.error('Vote error:', error);
    }
  }, [publication, voteOnPublicationMutation, updateWalletBalance, updateAll]);

  const handleComment = useCallback(async (comment: string, amount: number, directionPlus: boolean) => {
    if (!publication.id) return;

    try {
      await voteOnPublicationMutation.mutateAsync({
        publicationId: publication.id,
        data: {
          targetType: 'publication',
          targetId: publication.id,
          amount,
          sourceType: 'personal',
          attachedCommentId: comment, // Store comment separately
        },
      });

      // Update wallet balance optimistically
      if (updateWalletBalance && publication.communityId) {
        const change = directionPlus ? amount : -amount;
        updateWalletBalance(publication.communityId, change);
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
  }, [publication, voteOnPublicationMutation, updateWalletBalance, updateAll]);

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

