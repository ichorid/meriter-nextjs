// Publication business logic hook
import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVoteOnPublication, useVoteOnComment, useVoteOnPublicationWithComment } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useUserQuota } from '@/hooks/api/useQuota';
import { getWalletBalance } from '@/lib/utils/wallet';

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

  const voteOnPublicationMutation = useVoteOnPublication();
  const voteOnCommentMutation = useVoteOnComment();
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  
  // Get quota for the publication's community
  const { data: quotaData } = useUserQuota(publication.communityId);
  const quotaRemaining = quotaData?.remainingToday ?? 0;
  
  // Get wallet balance for the publication's community
  const walletBalance = useMemo(() => {
    return getWalletBalance(wallets, publication.communityId);
  }, [publication.communityId, wallets]);

  const handleVote = useCallback(async (direction: 'plus' | 'minus', amount: number = 1) => {
    if (!publication.id) return;

    try {
      const sourceType: 'personal' | 'quota' = 'quota'; // Use quota first for voting
      
      // Quota and wallet updates are now handled optimistically in the mutation hooks

      await voteOnPublicationMutation.mutateAsync({
        publicationId: publication.id,
        data: {
          targetType: 'publication',
          targetId: publication.id,
          amount,
          sourceType,
        },
        communityId: publication.communityId,
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

    // Check if comment is required and provided
    if (!comment?.trim()) {
      throw new Error('A reason for your vote is required');
    }

    try {
      const absoluteAmount = Math.abs(amount);
      const isUpvote = directionPlus;
      
      // Calculate vote breakdown: quota vs wallet
      // For upvotes: use quota first, then wallet
      // For downvotes: use wallet only
      let quotaAmount = 0;
      let walletAmount = 0;
      
      if (isUpvote) {
        quotaAmount = Math.min(absoluteAmount, quotaRemaining);
        walletAmount = Math.max(0, absoluteAmount - quotaRemaining);
      } else {
        // Downvotes use wallet only
        walletAmount = absoluteAmount;
        
        // Validate wallet balance for negative votes
        if (walletAmount > walletBalance) {
          throw new Error('Insufficient balance');
        }
      }

      // Use the combined endpoint that creates comment and vote atomically
      // If we need both quota and wallet votes, make two calls
      // but only create the comment with the first one
      if (quotaAmount > 0 && walletAmount > 0) {
        // First vote: quota + comment (if provided)
        await voteOnPublicationWithCommentMutation.mutateAsync({
          publicationId: publication.id,
          data: {
            amount: isUpvote ? quotaAmount : -quotaAmount,
            sourceType: 'quota',
            comment: comment.trim() || undefined,
          },
          communityId: publication.communityId,
        });
        
        // Second vote: wallet only (comment already created)
        await voteOnPublicationWithCommentMutation.mutateAsync({
          publicationId: publication.id,
          data: {
            amount: isUpvote ? walletAmount : -walletAmount,
            sourceType: 'personal',
          },
          communityId: publication.communityId,
        });
      } else if (quotaAmount > 0) {
        // Vote with quota only, include comment
        await voteOnPublicationWithCommentMutation.mutateAsync({
          publicationId: publication.id,
          data: {
            amount: isUpvote ? quotaAmount : -quotaAmount,
            sourceType: 'quota',
            comment: comment.trim() || undefined,
          },
          communityId: publication.communityId,
        });
      } else if (walletAmount > 0) {
        // Vote with wallet only, include comment
        await voteOnPublicationWithCommentMutation.mutateAsync({
          publicationId: publication.id,
          data: {
            amount: isUpvote ? walletAmount : -walletAmount,
            sourceType: 'personal',
            comment: comment.trim() || undefined,
          },
          communityId: publication.communityId,
        });
      }

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
  }, [publication, voteOnPublicationWithCommentMutation, quotaRemaining, walletBalance, updateAll]);

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
    
    // Actions
    handleVote,
    handleComment,
    
    // Computed values
    currentBalance: getCurrentBalance(),
    
    // Loading states
    isVoting: voteOnPublicationMutation.isPending,
    isCommenting: voteOnPublicationWithCommentMutation.isPending,
  };
}

