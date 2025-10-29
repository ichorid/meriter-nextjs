// Publication card component (presentational)
'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicationHeader } from './PublicationHeader';
import { PublicationContent } from './PublicationContent';
import { PublicationActions } from './PublicationActions';
import { usePublication } from '@/hooks/usePublication';
import { PollVoting } from '@features/polls/components/poll-voting';
import { usePollCardData } from '@/hooks/usePollCardData';
import { useWalletBalance } from '@/hooks/api/useWallet';

// Local type definitions
interface IPublication {
  id: string;
  slug?: string;
  title: string;
  content: string;
  authorId: string;
  communityId: string;
  type: 'text' | 'image' | 'video' | 'poll';
  createdAt: string;
  updatedAt: string;
  metrics?: {
    score: number;
    commentCount: number;
  };
  [key: string]: unknown;
}

interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

interface PublicationCardProps {
  publication: IPublication;
  wallets?: Wallet[];
  updateWalletBalance?: (currencyOfCommunityTgChatId: string, amountChange: number) => void;
  updateAll?: () => void;
  showCommunityAvatar?: boolean;
  className?: string;
  isSelected?: boolean;
}

export const PublicationCardComponent: React.FC<PublicationCardProps> = ({
  publication,
  wallets = [],
  updateWalletBalance,
  updateAll,
  showCommunityAvatar = false,
  className = '',
  isSelected = false,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check if this is a poll
  const isPoll = publication.type === 'poll';
  
  // For polls, fetch poll-specific data
  const { pollData, userVote, userVoteSummary } = usePollCardData(isPoll ? publication.id : undefined);
  
  // Get wallet balance for polls
  const { data: pollBalance = 0 } = useWalletBalance(isPoll ? publication.communityId : '');
  
  // For publications, use the publication hook
  const {
    activeCommentHook,
    activeSlider,
    setActiveSlider,
    activeWithdrawPost,
    setActiveWithdrawPost,
    handleVote,
    handleComment,
    currentBalance,
    isVoting,
    isCommenting,
  } = usePublication({
    publication: isPoll ? { ...publication, type: 'text' } : publication, // Temporarily set type to avoid errors
    wallets,
    updateWalletBalance,
    updateAll,
  });

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
          publication={publication}
          showCommunityAvatar={showCommunityAvatar}
          className="mb-4"
        />
        
        <PollVoting
          pollData={pollData}
          pollId={publication.id}
          userVote={userVote}
          userVoteSummary={userVoteSummary}
          balance={pollBalance}
          onVoteSuccess={() => {
            if (updateAll) updateAll();
          }}
          updateWalletBalance={updateWalletBalance}
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
        publication={publication}
        showCommunityAvatar={showCommunityAvatar}
        className="mb-4"
      />
      
      <PublicationContent
        publication={publication}
        className="mb-6"
      />
      
      <PublicationActions
        publication={publication}
        onVote={handleVote}
        onComment={handleComment}
        activeCommentHook={activeCommentHook}
        isVoting={isVoting}
        isCommenting={isCommenting}
        maxPlus={currentBalance}
        activeWithdrawPost={activeWithdrawPost}
        setActiveWithdrawPost={setActiveWithdrawPost}
        activeSlider={activeSlider}
        setActiveSlider={setActiveSlider}
        wallets={wallets}
        updateAll={updateAll}
        // maxMinus is calculated in PublicationActions using quota data
      />
    </article>
  );
};
