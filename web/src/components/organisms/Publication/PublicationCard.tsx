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

import type { Publication, Wallet } from '@/types/api-v1';

interface PublicationCardProps {
  publication: Publication;
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
  const { pollData, userCast, userCastSummary } = usePollCardData(isPoll ? publication.id : undefined);
  
  // Get wallet balance for polls
  const { data: pollBalance = 0 } = useWalletBalance(isPoll ? publication.communityId : '');
  
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
    const postSlug = publication.slug || publication.id;
    if (postSlug) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('post', postSlug);
      router.push(`?${params.toString()}`);
    }
  };

  // Render poll card
  if (isPoll && pollData) {
    return (
      <article 
        className={`card bg-base-100 shadow-md rounded-lg p-6 ${className}`}
      >
        <PublicationHeader
          publication={{
            ...publication,
            createdAt: publication.createdAt,
            id: publication.id,
          }}
          showCommunityAvatar={showCommunityAvatar}
          className="mb-4"
        />
        
        <PollCasting
          pollData={pollData}
          pollId={publication.id}
          userCast={userCast}
          userCastSummary={userCastSummary}
          balance={pollBalance}
          onCastSuccess={() => {
            // Mutations handle query invalidation automatically
          }}
          communityId={publication.communityId}
          initiallyExpanded={false}
        />
      </article>
    );
  }

  // Render publication card
  return (
    <article 
      className={`card bg-base-100 shadow-md rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow ${className}`}
      onClick={handleCardClick}
    >
      <PublicationHeader
        publication={{
          ...publication,
          createdAt: publication.createdAt,
          id: publication.id,
        }}
        showCommunityAvatar={showCommunityAvatar}
        className="mb-4"
      />
      
      <PublicationContent
        publication={{
          ...publication,
          createdAt: publication.createdAt,
          id: publication.id,
          content: publication.content,
        }}
        className="mb-6"
      />
      
      <PublicationActions
        publication={{
          ...publication,
          createdAt: publication.createdAt,
          id: publication.id,
          authorId: publication.authorId,
          communityId: publication.communityId,
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
