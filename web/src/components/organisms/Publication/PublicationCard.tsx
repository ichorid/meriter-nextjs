// Publication card component (presentational)
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  
  const currentBalance = getWalletBalance(wallets, publication.communityId);
  const isVoting = false;
  const isCommenting = false;

  const handleCardClick = () => {
    // Navigate to post detail page
    const postSlug = getPublicationIdentifier(publication);
    const communityId = publication.communityId;
    if (postSlug && communityId) {
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
      <div className="bg-base-100 rounded-2xl p-5 border border-base-content/5 hover:border-base-content/10 transition-all duration-200">
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
          initiallyExpanded={false}
        />
      </div>
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
    <div onClick={handleCardClick} className="cursor-pointer">
      <article className="bg-base-100 rounded-2xl p-5 border border-base-content/5 hover:border-base-content/10 transition-all duration-200">
        <PublicationHeader
          publication={{
            id: pubItem.id,
            slug: pubItem.slug,
            createdAt: pubItem.createdAt,
            meta: pubItem.meta,
            postType: (pubItem as any).postType,
            isProject: (pubItem as any).isProject,
          }}
          showCommunityAvatar={showCommunityAvatar}
          className="mb-3"
          authorId={pubItem.authorId}
          metrics={pubItem.metrics}
          publicationId={pubItem.id || pubItem.slug}
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
            imageUrl: (pubItem as any).imageUrl,
            meta: transformedMeta,
          }}
          className="mb-4"
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
            postType: (pubItem as any).postType,
            isProject: (pubItem as any).isProject,
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
    </div>
  );
};
