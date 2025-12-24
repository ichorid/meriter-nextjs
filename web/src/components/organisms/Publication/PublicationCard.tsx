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
  _className = '',
  _isSelected = false,
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
  const [activeCommentHook] = useState<[string | null, React.Dispatch<React.SetStateAction<string | null>>]>([null, () => {}]);
  
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
    if (isOnCommunityFeedPage) {
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
    <article 
      onClick={handleCardClick} 
      className="bg-base-100 rounded-2xl p-5 border border-base-content/5 hover:border-base-content/10 transition-all duration-200 cursor-pointer"
    >
        <PublicationHeader
          publication={{
            id: pubItem.id,
            slug: pubItem.slug,
            createdAt: pubItem.createdAt,
            meta: pubItem.meta,
            postType: (pubItem as unknown).postType,
            isProject: (pubItem as unknown).isProject,
            permissions: (pubItem as unknown).permissions,
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
            title: (pubItem as unknown).title,
            description: (pubItem as unknown).description,
            isProject: (pubItem as unknown).isProject,
            imageUrl: (pubItem as unknown).imageUrl,
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
            permissions: (pubItem as unknown).permissions,
            type: pubItem.type,
            metrics: pubItem.metrics,
            meta: transformedMeta,
            postType: (pubItem as unknown).postType,
            isProject: (pubItem as unknown).isProject,
          }}
          onVote={handleVote}
          onComment={handleComment}
          activeCommentHook={activeCommentHook}
          isVoting={isVoting}
          isCommenting={isCommenting}
          maxPlus={currentBalance}
          wallets={wallets}
          // maxMinus is calculated in PublicationActions using quota data
        />
    </article>
  );
};