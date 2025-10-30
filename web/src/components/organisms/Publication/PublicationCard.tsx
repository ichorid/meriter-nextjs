// Publication card component (presentational)
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicationHeader } from './PublicationHeader';
import { PublicationContent } from './PublicationContent';
import { PublicationActions } from './PublicationActions';
import { PollCasting } from '@features/polls/components/poll-casting';
import { usePollCardData } from '@/hooks/usePollCardData';
import { useWalletBalance } from '@/hooks/api/useWallet';

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
  
  // Check if this is a poll
  const isPoll = publication.type === 'poll';
  
  // For polls, fetch poll-specific data
  const pollId = isPoll ? (publication as PollFeedItem).id : undefined;
  const { pollData, userCast, userCastSummary } = usePollCardData(pollId);
  
  // Get wallet balance for polls
  const communityId = publication.communityId;
  const { data: pollBalance = 0 } = useWalletBalance(isPoll ? communityId : '');
  
  // For publications, use the publication hook
  // Note: usePublication expects a different Publication type, so we need to adapt
  // For now, skip using usePublication for cards and handle voting/commenting differently
  const [activeCommentHook] = useState<[string | null, React.Dispatch<React.SetStateAction<string | null>>]>([null, () => {}]);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  
  // Placeholder handlers - these should be implemented using React Query mutations
  const handleVote = () => {
    // TODO: Implement vote mutation
    console.warn('Vote not implemented in PublicationCard');
  };
  
  const handleComment = () => {
    // TODO: Implement comment mutation
    console.warn('Comment not implemented in PublicationCard');
  };
  
  const currentBalance = wallets.find(w => w.communityId === publication.communityId)?.balance || 0;
  const isVoting = false;
  const isCommenting = false;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements (buttons, links, etc.)
    // Note: PublicationActions already uses stopPropagation on its buttons,
    // but we check here as an additional safeguard
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[class*="clickable"]') ||
      target.closest('[class*="btn"]')
    ) {
      return;
    }

    // Only navigate if we have a slug or id
    const postSlug = publication.type === 'publication' 
      ? (publication as PublicationFeedItem).slug || publication.id
      : publication.id;
    if (postSlug) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('post', postSlug);
      router.push(`?${params.toString()}`);
    }
  };

  // Render poll card
  if (isPoll && pollData) {
    const pollItem = publication as PollFeedItem;
    return (
      <article 
        className={`card bg-base-100 shadow-md rounded-lg p-6 ${className}`}
      >
        <PublicationHeader
          publication={{
            id: pollItem.id,
            slug: undefined,
            createdAt: pollItem.createdAt,
            meta: pollItem.meta,
          }}
          showCommunityAvatar={showCommunityAvatar}
          className="mb-4"
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
          initiallyExpanded={false}
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
      className={`card bg-base-100 shadow-md rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow ${className}`}
      onClick={handleCardClick}
    >
      <PublicationHeader
        publication={{
          id: pubItem.id,
          slug: pubItem.slug,
          createdAt: pubItem.createdAt,
          meta: pubItem.meta,
        }}
        showCommunityAvatar={showCommunityAvatar}
        className="mb-4"
      />
      
      <PublicationContent
        publication={{
          id: pubItem.id,
          createdAt: pubItem.createdAt,
          content: pubItem.content,
          meta: transformedMeta,
        }}
        className="mb-6"
      />
      
      <PublicationActions
        publication={{
          id: pubItem.id,
          createdAt: pubItem.createdAt,
          authorId: pubItem.authorId,
          communityId: pubItem.communityId,
          slug: pubItem.slug,
          content: pubItem.content,
          type: pubItem.type,
          metrics: pubItem.metrics,
          meta: transformedMeta,
        }}
        onVote={handleVote}
        onComment={handleComment}
        activeCommentHook={activeCommentHook}
        isVoting={isVoting}
        isCommenting={isCommenting}
        maxPlus={currentBalance}
        activeSlider={activeSlider}
        setActiveSlider={setActiveSlider}
        wallets={wallets}
        // maxMinus is calculated in PublicationActions using quota data
      />
    </article>
  );
};
