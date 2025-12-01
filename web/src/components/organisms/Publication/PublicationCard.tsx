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
import { Pressable } from 'react-native';

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
    // Only navigate if we have a slug or id
    // Note: Interactive elements (buttons, links) should use stopPropagation
    // to prevent this handler from firing
    const postSlug = getPublicationIdentifier(publication);
    if (postSlug) {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('post', postSlug);
      router.push(`?${params.toString()}`);
    }
  };

  // Render poll card
  if (isPoll && pollData) {
    const pollItem = publication as PollFeedItem;
    return (
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-200">
        <div>
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
        </div>
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
    <Pressable onPress={handleCardClick}>
      <div 
        className="bg-white rounded-xl p-6 shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-200"
      >
      <div>
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
          className="mb-4"
        />
        
        <PublicationContent
          publication={{
            id: pubItem.id,
            createdAt: pubItem.createdAt,
            content: pubItem.content,
            title: (pubItem as any).title,
            description: (pubItem as any).description,
            isProject: (pubItem as any).isProject,
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
      </div>
    </div>
    </Pressable>
  );
};
