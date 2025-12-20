// Publication actions component
'use client';

import React from 'react';
import { BarVoteUnified } from '@shared/components/bar-vote-unified';
import { BarWithdraw } from '@shared/components/bar-withdraw';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getWalletBalance } from '@/lib/utils/wallet';
import { getPublicationIdentifier } from '@/lib/utils/publication';
import { useCommunity } from '@/hooks/api/useCommunities';
import { ResourcePermissions } from '@/types/api-v1';

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
  const t = useTranslations('feed');
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
    } else if (community?.typeTag === 'team') {
      // Team groups: quota-only (Q), no wallet (M)
      mode = 'quota-only';
    } else {
      // Non-special groups can only vote with quota on regular posts
      mode = 'quota-only';
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

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        {showWithdraw ? (
          <BarWithdraw
            balance={maxWithdrawAmount}
            onWithdraw={handleWithdrawClick}
            onTopup={handleTopupClick}
            showDisabled={isBeneficiary || (isAuthor && !hasBeneficiary)}
            isLoading={false}
            commentCount={publication.metrics?.commentCount || 0}
            onCommentClick={handleCommentClick}
          />
        ) : (
          <BarVoteUnified
            score={currentScore}
            onVoteClick={handleVoteClick}
            isAuthor={isAuthor}
            isBeneficiary={isBeneficiary}
            hasBeneficiary={hasBeneficiary}
            commentCount={publication.metrics?.commentCount || 0}
            onCommentClick={handleCommentClick}
            canVote={canVote}
            disabledReason={voteDisabledReason}
            communityId={communityId}
            slug={publication.slug}
          />
        )}
      </div>
    </div>
  );
};
