// Publication actions component
'use client';

import React, { useState } from 'react';
import { Hand, Share2, Star, Plus, Minus } from 'lucide-react';
import { FavoriteStar } from '@/components/atoms';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getWalletBalance } from '@/lib/utils/wallet';
import { getPublicationIdentifier } from '@/lib/utils/publication';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { ResourcePermissions } from '@/types/api-v1';
import { shareUrl, getPostUrl, getPollUrl } from '@shared/lib/share-utils';
import { hapticImpact } from '@shared/lib/utils/haptic-utils';
import { useVoteOnPublicationWithComment } from '@/hooks/api/useVotes';
import { isTestAuthMode } from '@/config';
import { useToastStore } from '@/shared/stores/toast.store';
import { trpc } from '@/lib/trpc/client';

// Local Publication type definition
interface Publication {
  id: string;
  slug?: string;
  authorId?: string;
  beneficiaryId?: string;
  content?: string;
  createdAt: string;
  communityId?: string;
  metrics?: {
    score?: number;
    commentCount?: number;
  };
  meta?: {
    author?: {
      id: string;
      name: string;
      photoUrl?: string;
      username?: string;
    };
    beneficiary?: {
      id: string;
      name: string;
      photoUrl?: string;
      username?: string;
    };
    origin?: {
      telegramChatName?: string;
    };
    hashtagName?: string;
  };
  permissions?: ResourcePermissions;
  withdrawals?: {
    totalWithdrawn?: number;
  };
  [key: string]: unknown;
}

interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  [key: string]: unknown;
}

interface PublicationActionsProps {
  publication: Publication;
  onVote: (direction: 'plus' | 'minus', amount: number) => void;
  onComment: (comment: string, amount: number, directionPlus: boolean) => void;
  activeCommentHook: readonly [string | null, (commentId: string | null) => void];
  isVoting?: boolean;
  isCommenting?: boolean;
  maxPlus?: number;
  maxMinus?: number;
  wallets?: Wallet[];
  updateAll?: () => void;
  className?: string;
  /** Hide vote button and score display, show only favorite and share */
  hideVoteAndScore?: boolean;
}

export const PublicationActions: React.FC<PublicationActionsProps> = ({
  publication,
  onVote,
  onComment,
  activeCommentHook,
  isVoting = false,
  isCommenting = false,
  maxPlus = 100,
  maxMinus = 100,
  wallets = [],
  updateAll,
  className = '',
  hideVoteAndScore = false,
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations('shared');
  const tComments = useTranslations('comments');
  const myId = user?.id;
  const testAuthMode = isTestAuthMode();
  const isSuperadmin = user?.globalRole === 'superadmin';
  const addToast = useToastStore((state) => state.addToast);
  const voteOnPublicationWithCommentMutation = useVoteOnPublicationWithComment();
  const createFromFakeUserMutation = trpc.votes.createFromFakeUser.useMutation();
  const utils = trpc.useUtils();
  const [isAddingVote, setIsAddingVote] = useState(false);
  const [isAddingNegativeVote, setIsAddingNegativeVote] = useState(false);
  
  // Check if we're on the community feed page (not the detail page)
  const isOnCommunityFeedPage = pathname?.match(/^\/meriter\/communities\/[^/]+$/);

  // Check if this is a PROJECT post (no voting allowed)
  // Feature flag: projects are currently disabled
  const isProject = false; // ENABLE_PROJECT_POSTS && ((publication as any).postType === 'project' || (publication as any).isProject === true);

  // Extract beneficiary information
  const beneficiaryId = publication.beneficiaryId || publication.meta?.beneficiary?.id;
  const authorId = publication.authorId;

  // Calculate beneficiary status
  const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== authorId);
  const isAuthor = !!(myId && authorId && myId === authorId);
  const isBeneficiary = !!(hasBeneficiary && myId && beneficiaryId && myId === beneficiaryId);
  const currentScore = publication.metrics?.score || 0;

  // Calculate withdraw amounts
  const totalWithdrawn = publication.withdrawals?.totalWithdrawn || 0;
  const availableForWithdrawal = Math.max(0, currentScore - totalWithdrawn);
  const maxWithdrawAmount = ((isAuthor && !hasBeneficiary) || isBeneficiary)
    ? Math.floor(10 * availableForWithdrawal) / 10
    : 0;

  // Calculate total votes (current score + withdrawn votes) for display
  // Only show when there are actual withdrawals and totalVotes > currentScore
  const totalVotes = totalWithdrawn > 0 ? currentScore + totalWithdrawn : undefined;
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV !== 'production' && totalWithdrawn > 0) {
    console.debug('[PublicationActions] Vote display:', {
      currentScore,
      totalWithdrawn,
      totalVotes,
      willShowTotalVotes: totalVotes !== undefined && totalVotes > currentScore,
    });
  }

  // Get current wallet balance for topup
  const communityId = publication.communityId;
  const currentBalance = getWalletBalance(wallets, communityId);
  const maxTopUpAmount = Math.floor(10 * currentBalance) / 10;

  // Get community info to check typeTag
  const { data: community } = useCommunity(communityId || '');
  const isSpecialGroup = community?.typeTag === 'marathon-of-good' || community?.typeTag === 'future-vision';
  
  // Get quota for balance checks
  const { quotasMap } = useCommunityQuotas(communityId ? [communityId] : []);
  const quotaData = communityId ? quotasMap.get(communityId) : null;
  const quotaRemaining = quotaData?.remainingToday ?? 0;

  // Mutual exclusivity logic
  // Withdrawal is enabled - users can manually withdraw accumulated votes to permanent merits
  // Check if community allows withdrawals
  const allowWithdraw = community?.settings?.allowWithdraw ?? true;
  const canShowWithdraw = ((isAuthor && !hasBeneficiary) || isBeneficiary);
  const showVote = !isAuthor && !isBeneficiary;
  const showVoteForAuthor = isAuthor && hasBeneficiary;

  const publicationId = getPublicationIdentifier(publication);

  // Use API permissions instead of calculating on frontend
  const canVote = publication.permissions?.canVote ?? false;
  const voteDisabledReason = publication.permissions?.voteDisabledReason;
  
  // Debug logging
  if (process.env.NODE_ENV !== 'production') {
    console.log('[PublicationActions] DEBUG', JSON.stringify({
      publicationId: publication.id,
      authorId,
      myId,
      isAuthor,
      communityId,
      hasPermissions: !!publication.permissions,
      permissions: publication.permissions,
      canVote,
      voteDisabledReason,
      communityTypeTag: community?.typeTag,
      fullPublication: Object.keys(publication)
    }, null, 2));
  }

  const handleVoteClick = () => {
    // Check if user is voting for own post (author or beneficiary)
    const isEffectiveBeneficiary = isAuthor || isBeneficiary;
    
    // If voting for own post, must use wallet only
    if (isEffectiveBeneficiary) {
      if (currentBalance === 0) {
        // Show toast notification if no wallet balance
        addToast(tComments('cannotVoteOwnPostNoWallet'), 'error');
        return;
      }
      // Force wallet-only mode for own posts
      useUIStore.getState().openVotingPopup(publicationId, 'publication', 'wallet-only');
      return;
    }
    
    // Determine currencySource from community settings
    const currencySource = community?.votingSettings?.currencySource || 
      (community?.typeTag === 'marathon-of-good' ? 'quota-only' : 
       community?.typeTag === 'future-vision' ? 'wallet-only' : 'quota-and-wallet');
    
    // Determine voting mode based on currencySource
    let mode: 'standard' | 'wallet-only' | 'quota-only' = 'standard';
    if (isProject) {
      mode = 'wallet-only';
    } else {
      if (currencySource === 'quota-only') {
        mode = 'quota-only';
      } else if (currencySource === 'wallet-only') {
        mode = 'wallet-only';
      } else if (currencySource === 'quota-and-wallet') {
        mode = 'standard';
      }
    }
    
    // Check balances before opening dialog
    const hasQuota = quotaRemaining > 0;
    const hasWallet = currentBalance > 0;
    
    // If no quota and no wallet, show toast notification and don't open dialog
    if (!hasQuota && !hasWallet) {
      addToast(tComments('cannotVoteNoMerits'), 'error');
      return;
    }
    
    // Check restrictions based on currencySource
    if (currencySource === 'quota-only') {
      // If quota-only and no quota, show toast notification
      if (!hasQuota) {
        addToast(tComments('cannotVoteNoQuotaQuotaOnly'), 'error');
        return;
      }
    } else if (currencySource === 'wallet-only') {
      // If wallet-only and no wallet, show toast notification
      if (!hasWallet) {
        addToast(tComments('cannotVoteNoWalletWalletOnly'), 'error');
        return;
      }
    }
    // For quota-and-wallet (standard), dialog will handle showing/hiding bars based on available balances
    
    useUIStore.getState().openVotingPopup(publicationId, 'publication', mode);
  };

  const handleCommentClick = () => {
    if (!publicationId || !communityId) return;
    
    // If on community feed page, set query parameter to show side panel
    if (isOnCommunityFeedPage) {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('post', publicationId);
      router.push(`${pathname}?${params.toString()}`);
    } else {
      // Otherwise, navigate to detail page
      router.push(`/meriter/communities/${communityId}/posts/${publicationId}`);
    }
  };

  // Handle withdraw button click - opens popup
  const handleWithdrawClick = () => {
    useUIStore.getState().openWithdrawPopup(
      publicationId,
      'publication',
      maxWithdrawAmount,
      maxTopUpAmount
    );
  };

  // Handle dev add positive vote button click (test mode only, superadmin only)
  const handleDevAddPositiveVote = async () => {
    if (!testAuthMode || !isSuperadmin || !publicationId || !communityId) return;
    
    try {
      setIsAddingVote(true);
      
      // Add a vote with +10 rating from fake user
      // Use walletAmount instead of quotaAmount to avoid quota limitations
      await createFromFakeUserMutation.mutateAsync({
        publicationId,
        communityId,
        targetType: 'publication',
        targetId: publicationId,
        quotaAmount: 0, // Not used for dev votes
        walletAmount: 10, // Use wallet for positive votes too
        comment: '[DEV] +10 рейтинг от фейкового пользователя',
        direction: 'up',
      });
      
      // Invalidate queries to refresh the publication data
      await utils.publications.getById.invalidate({ id: publicationId });
      await utils.publications.getAll.invalidate();
      
      addToast('Добавлено +10 рейтинга от фейкового пользователя', 'success');
      
      // Call updateAll if provided to refresh parent component
      if (updateAll) {
        updateAll();
      }
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при добавлении рейтинга', 'error');
    } finally {
      setIsAddingVote(false);
    }
  };

  // Handle dev add negative vote button click (test mode only, superadmin only)
  const handleDevAddNegativeVote = async () => {
    if (!testAuthMode || !isSuperadmin || !publicationId || !communityId) return;
    
    try {
      setIsAddingNegativeVote(true);
      
      // Add a vote with -10 rating from fake user
      await createFromFakeUserMutation.mutateAsync({
        publicationId,
        communityId,
        targetType: 'publication',
        targetId: publicationId,
        quotaAmount: 0,
        walletAmount: 10,
        comment: '[DEV] -10 рейтинг от фейкового пользователя',
        direction: 'down',
      });
      
      // Invalidate queries to refresh the publication data
      await utils.publications.getById.invalidate({ id: publicationId });
      await utils.publications.getAll.invalidate();
      
      addToast('Добавлено -10 рейтинга от фейкового пользователя', 'success');
      
      // Call updateAll if provided to refresh parent component
      if (updateAll) {
        updateAll();
      }
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при добавлении отрицательного рейтинга', 'error');
    } finally {
      setIsAddingNegativeVote(false);
    }
  };

  // Handle share click
  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticImpact('light');
    if (communityId) {
      let url: string;
      if (publication.slug) {
        url = getPostUrl(communityId, publication.slug);
      } else if (publication.type === 'poll' && publication.id) {
        url = getPollUrl(communityId, publication.id);
      } else {
        return; // No valid URL to share
      }
      await shareUrl(url, t('urlCopiedToBuffer'));
    }
  };

  // Get tooltip text for disabled vote button
  const getVoteTooltipText = (): string | undefined => {
    if (canVote) {
      return undefined;
    }
    if (voteDisabledReason) {
      try {
        const translated = t(voteDisabledReason);
        if (translated === voteDisabledReason) {
          return t('voteDisabled.default');
        }
        return translated;
      } catch {
        return t('voteDisabled.default');
      }
    }
    return t('voteDisabled.default');
  };

  const voteTooltipText = getVoteTooltipText();
  const commentCount = publication.metrics?.commentCount || 0;
  const publicationIdForFavorite = publicationId || publication.id;
  const targetType = (publication as any).postType === 'project' || (publication as any).isProject
    ? 'project'
    : 'publication';

  return (
    <div className={`pt-3 border-t border-base-300 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        {/* Left side: Favorite, Share, Dev Add Vote */}
        <div className="flex items-center gap-4">
          {/* Favorite */}
          {publicationIdForFavorite && (
            <FavoriteStar
              targetType={targetType}
              targetId={publicationIdForFavorite}
            />
          )}

          {/* Share */}
          {communityId && (publication.slug || (publication.type === 'poll' && publication.id)) && (
            <button
              onClick={handleShareClick}
              className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80"
              title={t('share')}
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {/* Dev Add Vote buttons (test mode, superadmin only) */}
          {testAuthMode && isSuperadmin && publicationId && communityId && (
            <>
              <button
                onClick={handleDevAddPositiveVote}
                disabled={isAddingVote || isAddingNegativeVote}
                className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Добавить +10 рейтинга от фейкового пользователя (DEV)"
              >
                <Plus className={`w-4 h-4 ${isAddingVote ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleDevAddNegativeVote}
                disabled={isAddingVote || isAddingNegativeVote}
                className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Добавить -10 рейтинга от фейкового пользователя (DEV)"
              >
                <Minus className={`w-4 h-4 ${isAddingNegativeVote ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
        </div>

        {/* Center: Score (clickable, opens comments) - hidden if hideVoteAndScore */}
        {!hideVoteAndScore && (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleCommentClick}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-base-200 transition-all active:scale-95 group"
              title={t('comments')}
            >
              <Hand className="w-4 h-4 text-base-content/50 group-hover:text-base-content/70 transition-colors" />
              <div className="flex items-center gap-2">
                <span className={`text-lg font-semibold tabular-nums transition-colors ${
                  currentScore > 0 ? "text-success group-hover:text-success/80" : currentScore < 0 ? "text-error group-hover:text-error/80" : "text-base-content/40 group-hover:text-base-content/60"
                }`}>
                  {currentScore > 0 ? '+' : ''}{currentScore}
                </span>
                {totalVotes !== undefined && 
                 typeof totalVotes === 'number' && 
                 !Number.isNaN(totalVotes) &&
                 typeof currentScore === 'number' && 
                 !Number.isNaN(currentScore) &&
                 totalVotes > currentScore && (
                  <span 
                    className="text-base-content/40 text-sm font-medium tabular-nums group-hover:text-base-content/50 transition-colors"
                    title={t('totalVotesTooltip')}
                  >
                    ({totalVotes > 0 ? '+' : ''}{totalVotes})
                  </span>
                )}
              </div>
            </button>
            
            {/* Withdraw button - centered below score */}
            {canShowWithdraw && (
              <button
                onClick={handleWithdrawClick}
                disabled={!allowWithdraw || maxWithdrawAmount <= 0}
                className={`h-8 px-4 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
                  (!allowWithdraw || maxWithdrawAmount <= 0)
                    ? 'bg-gray-200 dark:bg-gray-700 text-base-content/60 cursor-not-allowed'
                    : 'bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95'
                }`}
                title={
                  !allowWithdraw
                    ? t('cannotWithdrawInCommunity')
                    : maxWithdrawAmount <= 0
                    ? t('noVotesToWithdraw')
                    : undefined
                }
              >
                {t('withdraw')}
              </button>
            )}
          </div>
        )}

        {/* Right side: Vote button - hidden if hideVoteAndScore */}
        {!hideVoteAndScore && (
          <div className="flex items-center">
            <button
              onClick={handleVoteClick}
              disabled={!canVote}
              className={`h-8 px-4 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
                canVote
                  ? 'bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95'
                  : 'bg-gray-200 dark:bg-gray-700 text-base-content/60 cursor-not-allowed'
              }`}
              title={voteTooltipText}
            >
              <Hand className={`w-4 h-4 ${canVote ? 'text-base-100' : 'text-base-content/60'}`} />
              {t('vote')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
