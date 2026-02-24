// Publication card component (presentational)
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { PublicationHeader as PostHeader } from './PublicationHeader';
import { PublicationContent as PostContent } from './PublicationContent';
import { PublicationActions } from './PublicationActions';
import { PostMetrics, type ClosingSummary } from './PostMetrics';
import { PollCasting } from '@features/polls/components/poll-casting';
import { usePollCardData } from '@/hooks/usePollCardData';
import { getWalletBalance } from '@/lib/utils/wallet';
import { getPublicationIdentifier } from '@/lib/utils/publication';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { useCommunity } from '@/hooks/api/useCommunities';

import type { FeedItem, PublicationFeedItem, PollFeedItem, Wallet } from '@/types/api-v1';

interface PublicationCardProps {
  publication: FeedItem;
  wallets?: Wallet[];
  showCommunityAvatar?: boolean;
  className?: string;
  isSelected?: boolean;
  onCategoryClick?: (categoryId: string) => void;
  /** When set, show carousel preview actions: open post + optional back to carousel */
  onOpenPostPage?: () => void;
  /** When set with onOpenPostPage, show "Back to carousel" button (closes preview) */
  onBackToCarousel?: () => void;
}

export const PublicationCardComponent: React.FC<PublicationCardProps> = ({
  publication,
  wallets = [],
  showCommunityAvatar = false,
  className = '',
  isSelected = false,
  onCategoryClick,
  onOpenPostPage,
  onBackToCarousel,
}) => {
  const router = useRouter();
  const tCarousel = useTranslations('postCarousel');
  const tInvesting = useTranslations('investing');

  // Check if this is a poll
  const isPoll = publication.type === 'poll';

  // For polls, fetch poll-specific data
  const pollId = isPoll ? (publication as PollFeedItem).id : undefined;
  const { pollData, userCast, userCastSummary } = usePollCardData(pollId);

  // Get wallet balance for polls: priority communities (МД, ОБ, Projects, Feedback) use global wallet
  const communityId = publication.communityId;
  const { data: community } = useCommunity(communityId || '');
  const isPriorityCommunity =
    community?.typeTag === 'marathon-of-good' ||
    community?.typeTag === 'future-vision' ||
    community?.typeTag === 'team-projects' ||
    community?.typeTag === 'support';
  const balanceCommunityId = isPriorityCommunity ? GLOBAL_COMMUNITY_ID : communityId;
  const pollBalance = getWalletBalance(wallets, balanceCommunityId);
  const currentBalance = getWalletBalance(wallets, balanceCommunityId);

  // For publications, use the publication hook
  // Note: usePublication expects a different Publication type, so we need to adapt
  // For now, skip using usePublication for cards and handle voting/commenting differently
  const [activeCommentHook] = useState<[string | null, React.Dispatch<React.SetStateAction<string | null>>]>([null, () => { }]);

  // Placeholder handlers - these should be implemented using React Query mutations
  const handleVote = () => {
    // TODO: Implement vote mutation
    console.warn('Vote not implemented in PublicationCard');
  };

  const handleComment = () => {
    // TODO: Implement comment mutation
    console.warn('Comment not implemented in PublicationCard');
  };
  const isVoting = false;
  const isCommenting = false;

  const handleCardClick = (e: React.MouseEvent) => {
    if (onOpenPostPage) return; // In carousel preview mode, only the button navigates
    const target = e.target as HTMLElement;
    // Don't navigate when clicking the image gallery — open lightbox only, stay in feed
    if (target.closest('[data-gallery-preview]')) return;
    // Don't navigate if clicking on interactive elements (buttons, links, etc.)
    if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
      return;
    }

    const postSlug = getPublicationIdentifier(publication);
    const communityId = publication.communityId;

    if (!postSlug || !communityId) {
      console.warn('[PublicationCard] Cannot navigate: missing postSlug or communityId', { postSlug, communityId, publication });
      return;
    }

    // Always navigate to post detail page. Votes/comments panel opens only via the score button click.
    router.push(`/meriter/communities/${communityId}/posts/${postSlug}`);
  };

  // Render poll card
  if (isPoll && pollData) {
    const pollItem = publication as PollFeedItem;
    // Get metrics from pollData or use default
    const pollMetrics = {
      totalCasts: pollData.totalCasts || 0,
    };

    return (
      <article className="bg-[#F5F5F5] dark:bg-[#2a3239] rounded-xl p-5 shadow-none hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300">
        <PostHeader
          publication={{
            id: pollItem.id,
            slug: undefined,
            createdAt: pollItem.createdAt,
            meta: pollItem.meta,
          }}
          showCommunityAvatar={showCommunityAvatar}
          className="mb-4"
          authorId={pollItem.authorId}
          metrics={pollMetrics}
          publicationId={pollItem.id}
          communityId={pollItem.communityId}
          isPoll={true}
        />

        <PollCasting
          pollData={pollData}
          pollId={pollItem.id}
          userCast={userCast}
          userCastSummary={userCastSummary}
          balance={pollBalance}
          onCastSuccess={() => {
            // Mutations handle query invalidation automatically
          }}
          communityId={pollItem.communityId}
          noWrapper={true}
        />

        <PublicationActions
          publication={{
            id: pollItem.id,
            createdAt: pollItem.createdAt,
            authorId: pollItem.authorId,
            communityId: pollItem.communityId,
            slug: undefined,
            content: undefined,
            permissions: (pollItem as Record<string, unknown>).permissions,
            type: 'poll',
            metrics: pollMetrics,
            meta: pollItem.meta,
          }}
          onVote={() => {}}
          onComment={() => {}}
          activeCommentHook={activeCommentHook}
          isVoting={false}
          isCommenting={false}
          maxPlus={0}
          wallets={wallets}
          hideVoteAndScore={true}
        />
      </article>
    );
  }


  // Render publication card
  const pubItem = publication as PublicationFeedItem;

  // Transform meta to include id fields expected by child components
  const transformedMeta = {
    ...pubItem.meta,
    author: {
      ...pubItem.meta.author,
      id: pubItem.authorId,
    },
    beneficiary: pubItem.meta.beneficiary && pubItem.beneficiaryId
      ? {
        ...pubItem.meta.beneficiary,
        id: pubItem.beneficiaryId,
      }
      : undefined,
  };

  return (
    <article
      onClick={handleCardClick}
      className="bg-[#F5F5F5] dark:bg-[#2a3239] rounded-xl p-5 shadow-none hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300"
    >
      <PostHeader
        publication={{
          id: pubItem.id,
          slug: pubItem.slug,
          createdAt: pubItem.createdAt,
          meta: pubItem.meta,
          postType: (pubItem as any).postType,
          isProject: (pubItem as any).isProject,
          permissions: (pubItem as any).permissions,
        }}
        showCommunityAvatar={showCommunityAvatar}
        className="mb-3"
        authorId={pubItem.authorId}
        metrics={pubItem.metrics}
        publicationId={pubItem.id}
        communityId={pubItem.communityId}
        isPoll={false}
      />

        <PostContent
        publication={{
          id: pubItem.id,
          createdAt: pubItem.createdAt,
          content: pubItem.content,
          title: (pubItem as any).title,
          description: (pubItem as any).description,
          isProject: (pubItem as any).isProject,
          postType: (pubItem as any).postType,
          images: (pubItem as any).images, // Pass images array
          hashtags: (pubItem as any).hashtags || [], // Pass hashtags array
          categories: (pubItem as any).categories || [], // Pass categories array
          // Taxonomy fields
          impactArea: (pubItem as any).impactArea,
          stage: (pubItem as any).stage,
          beneficiaries: (pubItem as any).beneficiaries,
          methods: (pubItem as any).methods,
          helpNeeded: (pubItem as any).helpNeeded,
          meta: transformedMeta,
        }}
        className="mb-4"
        onCategoryClick={onCategoryClick}
      />

      {onOpenPostPage ? (
        <div className="pt-3 border-t border-base-300">
          <PostMetrics
            isClosed={(pubItem as Record<string, unknown>).status === 'closed'}
            hideVoteAndScore={false}
            currentScore={pubItem.metrics?.score ?? 0}
            totalVotes={undefined}
            onRatingClick={(e) => {
              e.stopPropagation();
              onOpenPostPage();
            }}
            investingEnabled={!!(pubItem as Record<string, unknown>).investingEnabled}
            investmentPool={((pubItem as Record<string, unknown>).investmentPool as number) ?? 0}
            investorCount={((pubItem as Record<string, unknown>).investments as { length?: number }[])?.length ?? 0}
            publicationId={pubItem.id}
            breakdownPostId={null}
            onBreakdownClick={() => {}}
            onBreakdownOpenChange={() => {}}
            investorsLabel={tInvesting('investorsCompact', { count: ((pubItem as Record<string, unknown>).investments as unknown[])?.length ?? 0 })}
            viewBreakdownTitle={tInvesting('viewBreakdown')}
            ttlExpiresAt={(pubItem as Record<string, unknown>).ttlExpiresAt as Date | string | null | undefined}
            closingSummary={(pubItem as Record<string, unknown>).closingSummary as ClosingSummary | undefined}
          />
          <div className="flex flex-wrap items-center justify-end gap-3 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPostPage();
              }}
              className="h-8 px-4 text-xs font-medium rounded-lg transition-all flex items-center gap-2 bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              {tCarousel('openPost')}
            </button>
            {onBackToCarousel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBackToCarousel();
                }}
                className="h-8 px-4 text-xs font-medium rounded-lg transition-all flex items-center gap-2 bg-base-200 text-base-content hover:bg-base-300 active:scale-95 border border-base-300"
              >
                {tCarousel('backToCarousel')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <PublicationActions
          publication={{
            id: pubItem.id,
            createdAt: pubItem.createdAt,
            authorId: pubItem.authorId,
            beneficiaryId: pubItem.beneficiaryId,
            communityId: pubItem.communityId,
            slug: pubItem.slug,
            content: pubItem.content,
            permissions: (pubItem as Record<string, unknown>).permissions,
            type: pubItem.type,
            metrics: pubItem.metrics,
            meta: transformedMeta,
            postType: (pubItem as Record<string, unknown>).postType,
            isProject: (pubItem as Record<string, unknown>).isProject,
            withdrawals: ((pubItem as Record<string, unknown>).withdrawals as Record<string, unknown>) || { totalWithdrawn: 0 },
            investingEnabled: (pubItem as Record<string, unknown>).investingEnabled,
            investorSharePercent: (pubItem as Record<string, unknown>).investorSharePercent,
            investmentPool: (pubItem as Record<string, unknown>).investmentPool ?? 0,
            investmentPoolTotal: (pubItem as Record<string, unknown>).investmentPoolTotal ?? 0,
            status: (pubItem as Record<string, unknown>).status as string | undefined,
            closingSummary: (pubItem as Record<string, unknown>).closingSummary as { totalEarned: number; distributedToInvestors: number; authorReceived: number; spentOnShows: number } | undefined,
            ttlExpiresAt: (pubItem as Record<string, unknown>).ttlExpiresAt as Date | string | null | undefined,
          }}
          onVote={handleVote}
          onComment={handleComment}
          activeCommentHook={activeCommentHook}
          isVoting={isVoting}
          isCommenting={isCommenting}
          maxPlus={currentBalance}
          wallets={wallets}
          hideVoteAndScore={false} // Projects are disabled via feature flag
        // maxMinus is calculated in PublicationActions using quota data
        />
      )}
    </article>
  );
};
