// Publication card component (presentational)
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { PublicationHeader } from './PublicationHeader';
import { PublicationContent } from './PublicationContent';
import { PublicationActions } from './PublicationActions';
import { PollCasting } from '@features/polls/components/poll-casting';
import { usePollCardData } from '@/hooks/usePollCardData';
import { getWalletBalance } from '@/lib/utils/wallet';
import { getPublicationIdentifier } from '@/lib/utils/publication';

import type { FeedItem, PublicationFeedItem, PollFeedItem, Wallet } from '@/types/api-v1';

interface PublicationCardProps {
  publication: FeedItem;
  wallets?: Wallet[];
  showCommunityAvatar?: boolean;
  className?: string;
  isSelected?: boolean;
}

export const PublicationCardComponent: React.FC<PublicationCardProps> = ({
  publication,
  wallets = [],
  showCommunityAvatar = false,
  className = '',
  isSelected = false,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Check if we're on the community feed page (not the detail page)
  const isOnCommunityFeedPage = pathname?.match(/^\/meriter\/communities\/[^/]+$/);

  // Check if this is a poll
  const isPoll = publication.type === 'poll';

  // For polls, fetch poll-specific data
  const pollId = isPoll ? (publication as PollFeedItem).id : undefined;
  const { pollData, userCast, userCastSummary } = usePollCardData(pollId);

  // Get wallet balance for polls
  const communityId = publication.communityId;
  // Use wallets array to get balance instead of separate query
  const pollBalance = getWalletBalance(wallets, communityId);

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

  const currentBalance = getWalletBalance(wallets, publication.communityId);
  const isVoting = false;
  const isCommenting = false;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements (buttons, links, etc.)
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
      return;
    }

    const postSlug = getPublicationIdentifier(publication);
    const communityId = publication.communityId;

    if (!postSlug || !communityId) {
      console.warn('[PublicationCard] Cannot navigate: missing postSlug or communityId', { postSlug, communityId, publication });
      return;
    }

    // If on community feed page, set query parameter to show side panel
    // BUT only if screen is wide enough (adaptive panel logic)
    // Default limit: 1280px
    const ADAPTIVE_PANEL_MIN_WIDTH = 1280;
    const isWideScreen = typeof window !== 'undefined' && window.innerWidth >= ADAPTIVE_PANEL_MIN_WIDTH;

    if (isOnCommunityFeedPage && isWideScreen) {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('post', postSlug);
      router.push(`${pathname}?${params.toString()}`);
    } else {
      // Otherwise, navigate to detail page
      router.push(`/meriter/communities/${communityId}/posts/${postSlug}`);
    }
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
        <PublicationHeader
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
            permissions: (pollItem as any).permissions,
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
      <PublicationHeader
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

      <PublicationContent
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
          // Taxonomy fields
          impactArea: (pubItem as any).impactArea,
          stage: (pubItem as any).stage,
          beneficiaries: (pubItem as any).beneficiaries,
          methods: (pubItem as any).methods,
          helpNeeded: (pubItem as any).helpNeeded,
          meta: transformedMeta,
        }}
        className="mb-4"
      />

      <PublicationActions
        publication={{
          id: pubItem.id,
          createdAt: pubItem.createdAt,
          authorId: pubItem.authorId,
          beneficiaryId: pubItem.beneficiaryId,
          communityId: pubItem.communityId,
          slug: pubItem.slug,
          content: pubItem.content,
          permissions: (pubItem as any).permissions,
          type: pubItem.type,
          metrics: pubItem.metrics,
          meta: transformedMeta,
          postType: (pubItem as any).postType,
          isProject: (pubItem as any).isProject,
          withdrawals: (pubItem as any).withdrawals || { totalWithdrawn: 0 },
        }}
        onVote={handleVote}
        onComment={handleComment}
        activeCommentHook={activeCommentHook}
        isVoting={isVoting}
        isCommenting={isCommenting}
        maxPlus={currentBalance}
        wallets={wallets}
        hideVoteAndScore={(pubItem as any).postType === 'project' || (pubItem as any).isProject === true}
      // maxMinus is calculated in PublicationActions using quota data
      />
    </article>
  );
};
