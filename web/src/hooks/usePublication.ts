// Publication business logic hook
import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVoteOnPublication, useVoteOnVote, useVoteOnPublicationWithComment } from '@/hooks/api';
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

  const voteOnPublicationMutation = useVoteOnPublication();
  const voteOnVoteMutation = useVoteOnVote();
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
      // Use quota first for voting
      // Calculate vote breakdown: quota vs wallet
      const quotaAmount = amount; // Use quota for voting
      const walletAmount = 0;
      
      await voteOnPublicationMutation.mutateAsync({
        publicationId: publication.id,
        data: {
          targetType: 'publication',
          targetId: publication.id,
          quotaAmount,
          walletAmount,
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
      
      // Validate that amount is positive
      if (absoluteAmount <= 0) {
        throw new Error('Vote amount must be greater than zero');
      }
      
      const isUpvote = directionPlus;
      
      // Calculate vote breakdown: quota vs wallet
      // For upvotes: use quota first, then wallet
      // For downvotes: use wallet only
      let quotaAmount = 0;
      let walletAmount = 0;
      
      if (isUpvote) {
        // Use quota first, then wallet
        // If quotaRemaining > 0, use it; otherwise try quota anyway (might be stale data)
        // Server will validate and return error if quota is actually exhausted
        if (quotaRemaining > 0) {
          quotaAmount = Math.min(absoluteAmount, quotaRemaining);
          walletAmount = Math.max(0, absoluteAmount - quotaRemaining);
        } else {
          // Quota appears 0 (might be stale) - try quota first, server will validate
          // If quota fails, we'll need wallet as fallback, but for now try quota
          quotaAmount = absoluteAmount;
          walletAmount = 0;
        }
      } else {
        // Downvotes use wallet only
        walletAmount = absoluteAmount;
        
        // Validate wallet balance for negative votes
        if (walletAmount > walletBalance) {
          throw new Error('Insufficient balance');
        }
      }

      // Validate that at least one amount is non-zero before sending
      if (quotaAmount === 0 && walletAmount === 0) {
        if (isUpvote) {
          throw new Error('Insufficient quota and wallet balance to complete this vote');
        } else {
          throw new Error('Insufficient wallet balance for downvote');
        }
      }

      // Use the combined endpoint that creates comment and vote atomically
      // Send single API call with both quotaAmount and walletAmount
      await voteOnPublicationWithCommentMutation.mutateAsync({
        publicationId: publication.id,
        data: {
          quotaAmount: quotaAmount > 0 ? quotaAmount : undefined,
          walletAmount: walletAmount > 0 ? walletAmount : undefined,
          comment: comment.trim() || undefined,
        },
        communityId: publication.communityId,
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
  }, [publication, voteOnPublicationWithCommentMutation, quotaRemaining, walletBalance, updateAll]);

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

