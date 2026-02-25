// Publication actions component — composes PostMetrics + PostActions
'use client';

import React, { useState } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getWalletBalance } from '@/lib/utils/wallet';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { getPublicationIdentifier } from '@/lib/utils/publication';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { ResourcePermissions } from '@/types/api-v1';
import { shareUrl, getPostUrl, getPollUrl } from '@shared/lib/share-utils';
import { hapticImpact } from '@shared/lib/utils/haptic-utils';
import { useInvestors } from '@/hooks/api/useInvestments';
import { isTestAuthMode } from '@/config';
import { useToastStore } from '@/shared/stores/toast.store';
import { trpc } from '@/lib/trpc/client';
import { PostMetrics } from './PostMetrics';
import { PostActions } from './PostActions';
import { ClosePostDialog } from './ClosePostDialog';

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
  /** D-10: Post status for closed display */
  status?: 'active' | 'closed';
  closeReason?: string;
  closingSummary?: {
    totalEarned: number;
    distributedToInvestors: number;
    authorReceived: number;
    spentOnShows: number;
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
  const tCommon = useTranslations('common');
  const tComments = useTranslations('comments');
  const tInvesting = useTranslations('investing');
  const tPostClosing = useTranslations('postClosing');
  const myId = user?.id;
  const testAuthMode = isTestAuthMode();
  const isSuperadmin = user?.globalRole === 'superadmin';
  const addToast = useToastStore((state) => state.addToast);
  const createFromFakeUserMutation = trpc.votes.createFromFakeUser.useMutation();
  const utils = trpc.useUtils();
  const [isAddingVote, setIsAddingVote] = useState(false);
  const [isAddingNegativeVote, setIsAddingNegativeVote] = useState(false);
  const [showClosePostDialog, setShowClosePostDialog] = useState(false);
  
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
  
  // Get fresh publication data from cache if available (to get updated score after tappalka)
  const publicationId = getPublicationIdentifier(publication);
  const { data: freshPublication } = trpc.publications.getById.useQuery(
    { id: publicationId },
    {
      enabled: !!publicationId,
      staleTime: 0, // Always consider stale to get fresh data
      refetchOnMount: false, // Don't refetch on mount, just use cache if available
      refetchOnWindowFocus: false,
    },
  );
  
  // Use fresh data if available, otherwise fall back to prop data
  const effectivePublication = freshPublication || publication;
  const currentScore = effectivePublication.metrics?.score || 0;

  const totalWithdrawn = effectivePublication.withdrawals?.totalWithdrawn || 0;
  // Max withdraw = full post rating (metrics.score) — includes votes, tappalka, etc.
  // Backend uses publication.getMetrics.score directly; totalWithdrawn is for display only.
  const maxWithdrawAmount = ((isAuthor && !hasBeneficiary) || isBeneficiary)
    ? Math.floor(10 * Math.max(0, currentScore)) / 10
    : 0;

  // Calculate total votes (current score + withdrawn votes) for display
  // Only show when there are actual withdrawals and totalVotes > currentScore
  const totalVotes = totalWithdrawn > 0 ? currentScore + totalWithdrawn : undefined;

  // Get community info to check typeTag (before balance lookup)
  const communityId = publication.communityId;
  const { data: community } = useCommunity(communityId || '');
  const isSpecialGroup = community?.typeTag === 'marathon-of-good' || community?.typeTag === 'future-vision';
  // G-11: Priority communities use global wallet for balance (voting, investing, fees)
  const isPriorityCommunity =
    community?.typeTag === 'marathon-of-good' ||
    community?.typeTag === 'future-vision' ||
    community?.typeTag === 'team-projects' ||
    community?.typeTag === 'support';
  const balanceCommunityId = isPriorityCommunity ? GLOBAL_COMMUNITY_ID : communityId;
  const currentBalance = getWalletBalance(wallets, balanceCommunityId);
  const maxTopUpAmount = Math.floor(10 * currentBalance) / 10;

  // Investment data (only when post has investing enabled)
  const investingEnabled = (publication as any).investingEnabled ?? false;
  const investorSharePercent = (publication as any).investorSharePercent ?? 50;
  const investmentPool = (publication as any).investmentPool ?? 0;
  const investmentPoolTotal = (publication as any).investmentPoolTotal ?? 0;
  const { data: investorsData } = useInvestors(investingEnabled ? publicationId : undefined);
  const investments = investorsData ?? [];
  const [breakdownPostId, setBreakdownPostId] = useState<string | null>(null);

  // Get quota for balance checks
  const { quotasMap } = useCommunityQuotas(communityId ? [communityId] : []);
  const quotaData = communityId ? quotasMap.get(communityId) : null;
  const quotaRemaining = quotaData?.remainingToday ?? 0;

  // Mutual exclusivity logic
  // Withdrawal is enabled - users can manually withdraw accumulated votes to permanent merits
  // Check if community allows withdrawals
  const allowWithdraw = community?.settings?.allowWithdraw ?? true;
  const canShowWithdraw = ((isAuthor && !hasBeneficiary) || isBeneficiary);

  // Use API permissions instead of calculating on frontend
  const canVote = publication.permissions?.canVote ?? false;
  const voteDisabledReason = publication.permissions?.voteDisabledReason;

  // D-10: Closed post — show summary, hide financial actions, keep favorite/share/comment
  const publicationStatus = (publication as { status?: string }).status ?? effectivePublication?.status ?? 'active';
  const isClosed = publicationStatus === 'closed';
  const closingSummary = (publication as { closingSummary?: { totalEarned: number; distributedToInvestors: number; authorReceived: number; spentOnShows: number } }).closingSummary
    ?? (effectivePublication as { closingSummary?: { totalEarned: number; distributedToInvestors: number; authorReceived: number; spentOnShows: number } } | undefined)?.closingSummary;

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

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!publicationId || !communityId) return;
    // If on community feed page, set query parameter to show votes/comments panel
    if (isOnCommunityFeedPage) {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('post', publicationId);
      router.push(`${pathname}?${params.toString()}`);
    } else {
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
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : t('addRatingError'), 'error');
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
        comment: t('devAddNegativeRatingComment'),
        direction: 'down',
      });
      
      // Invalidate queries to refresh the publication data
      await utils.publications.getById.invalidate({ id: publicationId });
      await utils.publications.getAll.invalidate();
      
      addToast(t('devAddNegativeRatingSuccess'), 'success');
      
      // Call updateAll if provided to refresh parent component
      if (updateAll) {
        updateAll();
      }
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : t('addNegativeRatingError'), 'error');
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
  const publicationIdForFavorite = publicationId || publication.id;
  const targetType = (publication as any).postType === 'project' || (publication as any).isProject
    ? 'project'
    : 'publication';

  // D-10: When closed, open voting popup for neutral comment only (popup forces neutralOnly)
  const handleCommentOnlyClick = () => {
    if (!publicationId) return;
    useUIStore.getState().openVotingPopup(publicationId, 'publication', 'standard');
  };

  const withdrawDisabledTitle =
    !allowWithdraw ? t('cannotWithdrawInCommunity') : maxWithdrawAmount <= 0 ? t('noVotesToWithdraw') : undefined;

  const ttlExpiresAt =
    (effectivePublication as { ttlExpiresAt?: Date | string | null })?.ttlExpiresAt ??
    (publication as { ttlExpiresAt?: Date | string | null })?.ttlExpiresAt ??
    null;

  const isPoll = publication.type === 'poll';
  const showClosePostButton =
    isAuthor &&
    publicationId &&
    !isPoll &&
    publicationStatus === 'active';
  const canEdit = publication.permissions?.canEdit ?? false;

  const handleClosePostClick = () => setShowClosePostDialog(true);
  const handleSettingsClick = () => {
    if (communityId && publicationId) {
      router.push(`/meriter/communities/${communityId}/edit/${publicationId}`);
    }
  };

  const publicationForClose = effectivePublication as {
    investments?: Array<{ investorId: string; amount: number }>;
    investmentPool?: number;
    investorSharePercent?: number;
  };
  const closeDialogInvestments = publicationForClose?.investments ?? [];

  return (
    <div className={`pt-3 border-t border-base-300 ${className}`}>
      <PostMetrics
        isClosed={isClosed}
        hideVoteAndScore={hideVoteAndScore}
        currentScore={currentScore}
        totalVotes={totalVotes}
        totalVotesTooltip={t('totalVotesTooltip')}
        onRatingClick={handleCommentClick}
        investingEnabled={investingEnabled}
        investmentPool={investmentPool}
        investorCount={investments.length}
        publicationId={publicationId}
        breakdownPostId={breakdownPostId}
        onBreakdownClick={(e) => {
          e.stopPropagation();
          setBreakdownPostId(publicationId ?? null);
        }}
        onBreakdownOpenChange={() => setBreakdownPostId(null)}
        investorsLabel={tInvesting('investorsCompact', { count: investments.length, defaultValue: 'investors' })}
        viewBreakdownTitle={tInvesting('viewBreakdown', { defaultValue: 'View investment breakdown' })}
        ttlExpiresAt={ttlExpiresAt}
        closingSummary={closingSummary}
      />
      <PostActions
        isAuthor={isAuthor}
        isBeneficiary={isBeneficiary}
        isClosed={isClosed}
        hideVoteAndScore={hideVoteAndScore}
        publicationIdForFavorite={publicationIdForFavorite}
        targetType={targetType}
        communityId={communityId}
        hasShareUrl={!!(publication.slug || (publication.type === 'poll' && publication.id))}
        onShareClick={handleShareClick}
        onCommentOnlyClick={handleCommentOnlyClick}
        showAddMerits={isAuthor && investingEnabled && !!myId}
        investButtonProps={{
          postId: publicationId,
          communityId: communityId || '',
          isAuthor,
          investingEnabled,
          investorSharePercent,
          investmentPool,
          investmentPoolTotal,
          investorCount: investments.length,
          walletBalance: currentBalance,
          onSuccess: updateAll,
        }}
        showWithdrawButton={canShowWithdraw}
        onWithdrawClick={handleWithdrawClick}
        allowWithdraw={allowWithdraw}
        maxWithdrawAmount={maxWithdrawAmount}
        withdrawDisabledTitle={withdrawDisabledTitle}
        showMoreMenu={isAuthor && !isClosed && (showClosePostButton || canEdit || (testAuthMode && isSuperadmin))}
        showCloseInMore={showClosePostButton}
        showSettingsInMore={canEdit}
        onClosePostClick={handleClosePostClick}
        onSettingsClick={handleSettingsClick}
        showInvestButton={!isAuthor && investingEnabled && !!myId}
        showVoteButton={!hideVoteAndScore && !isClosed && !isAuthor && !isBeneficiary}
        canVote={canVote}
        onVoteClick={handleVoteClick}
        voteTooltipText={voteTooltipText}
        showAdminButtons={!!(testAuthMode && isSuperadmin && publicationId && communityId)}
        isAddingVote={isAddingVote}
        isAddingNegativeVote={isAddingNegativeVote}
        onDevAddPositiveVote={handleDevAddPositiveVote}
        onDevAddNegativeVote={handleDevAddNegativeVote}
        shareTitle={t('share')}
        commentsTitle={t('comments')}
        voteLabel={tComments('commentButton')}
        withdrawLabel={t('withdraw')}
        closePostTitle={tPostClosing('closePostTitle', { defaultValue: 'Close post' })}
        settingsTitle={tCommon('edit')}
      />
      {showClosePostDialog &&
        publicationId &&
        (effectivePublication || publication) && (
          <ClosePostDialog
            open={showClosePostDialog}
            onOpenChange={setShowClosePostDialog}
            publicationId={publicationId}
            currentScore={effectivePublication.metrics?.score ?? 0}
            hasInvestments={(closeDialogInvestments?.length ?? 0) > 0}
            investmentPool={publicationForClose?.investmentPool ?? 0}
            investorSharePercent={publicationForClose?.investorSharePercent ?? 0}
            investments={closeDialogInvestments.map((inv: { investorId: string; amount: number }) => ({
              investorId: inv.investorId,
              amount: inv.amount,
            }))}
            distributeAllByContractOnClose={community?.settings?.distributeAllByContractOnClose ?? true}
            onSuccess={updateAll}
          />
        )}
    </div>
  );
};
