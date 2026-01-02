// Publication actions component
'use client';

import React from 'react';
import { MessageCircle, Share2, Star } from 'lucide-react';
import { FavoriteStar } from '@/components/atoms';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getWalletBalance } from '@/lib/utils/wallet';
import { getPublicationIdentifier } from '@/lib/utils/publication';
import { useCommunity } from '@/hooks/api/useCommunities';
import { ResourcePermissions } from '@/types/api-v1';
import { shareUrl, getPostUrl } from '@shared/lib/share-utils';
import { hapticImpact } from '@shared/lib/utils/haptic-utils';

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
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations('shared');
  const myId = user?.id;
  
  // Check if we're on the community feed page (not the detail page)
  const isOnCommunityFeedPage = pathname?.match(/^\/meriter\/communities\/[^/]+$/);

  // Check if this is a PROJECT post (no voting allowed)
  const isProject = (publication as any).postType === 'project' || (publication as any).isProject === true;

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

  // Mutual exclusivity logic
  // Withdrawal is enabled - users can manually withdraw accumulated votes to permanent merits
  const showWithdraw = ((isAuthor && !hasBeneficiary) || isBeneficiary) && maxWithdrawAmount > 0;
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
    let mode: 'standard' | 'wallet-only' | 'quota-only' = 'standard';
    if (isProject) {
      mode = 'wallet-only';
    } else if (community?.typeTag === 'future-vision') {
      // Future Vision: wallet-only (M), no quota (Q)
      mode = 'wallet-only';
    } else if (community?.typeTag === 'marathon-of-good') {
      // Marathon-of-Good: quota-only (Q), no wallet (M)
      mode = 'quota-only';
    } else {
      // Regular and team communities: allow spending daily quota first, then overflow into wallet merits
      mode = 'standard';
    }
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

  // Handle topup button click - opens popup for adding votes
  const handleTopupClick = () => {
    useUIStore.getState().openWithdrawPopup(
      publicationId,
      'publication-topup',
      maxWithdrawAmount,
      maxTopUpAmount
    );
  };

  // Handle share click
  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticImpact('light');
    if (communityId && publication.slug) {
      const url = getPostUrl(communityId, publication.slug);
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
        {/* Left side: Favorite, Share */}
        <div className="flex items-center gap-4">
          {/* Favorite */}
          {publicationIdForFavorite && (
            <FavoriteStar
              targetType={targetType}
              targetId={publicationIdForFavorite}
            />
          )}

          {/* Share */}
          {communityId && publication.slug && (
            <button
              onClick={handleShareClick}
              className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80"
              title={t('share')}
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Center: Score (clickable, opens comments) */}
        <button
          onClick={handleCommentClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-base-200 transition-all active:scale-95 group"
          title={t('comments')}
        >
          <MessageCircle className="w-4 h-4 text-base-content/50 group-hover:text-base-content/70 transition-colors" />
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
            {commentCount > 0 && (
              <span className="text-xs font-medium text-base-content/50 group-hover:text-base-content/70 transition-colors ml-1">
                · {commentCount}
              </span>
            )}
          </div>
        </button>

        {/* Right side: Vote button */}
        <div className="flex items-center">
          {canVote ? (
            <button
              onClick={handleVoteClick}
              className="h-8 px-4 text-xs font-medium rounded-lg transition-all bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95"
              title={voteTooltipText}
            >
              {t('vote')}
            </button>
          ) : (
            <span 
              className="text-xs font-medium text-base-content/30"
              title={voteTooltipText}
            >
              {t('vote')}
            </span>
          )}
        </div>
      </div>

      {/* Withdraw/Topup buttons - show below if applicable */}
      {showWithdraw && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-base-300">
          <button
            onClick={handleWithdrawClick}
            disabled={maxWithdrawAmount <= 0}
            className={`h-8 px-4 text-xs font-medium rounded-lg transition-all ${
              maxWithdrawAmount <= 0
                ? 'bg-base-content/5 text-base-content/30 cursor-not-allowed'
                : 'bg-base-content/10 text-base-content hover:bg-base-content/20 active:scale-95'
            }`}
            title={maxWithdrawAmount <= 0 ? t('noVotesToWithdraw') : undefined}
          >
            {t('withdraw')}
          </button>
          {maxTopUpAmount > 0 && (
            <button
              onClick={handleTopupClick}
              className="h-8 px-4 text-xs font-medium rounded-lg transition-all bg-base-content/10 text-base-content hover:bg-base-content/20 active:scale-95"
            >
              {t('addMerits', { amount: Math.floor(maxTopUpAmount * 10) / 10 })}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
