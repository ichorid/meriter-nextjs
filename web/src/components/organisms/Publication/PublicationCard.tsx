// Publication card component (presentational)
'use client';

import React from 'react';
import { PublicationHeader } from './PublicationHeader';
import { PublicationContent } from './PublicationContent';
import { PublicationActions } from './PublicationActions';
import { usePublication } from '@/hooks/usePublication';

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
}

export const PublicationCardComponent: React.FC<PublicationCardProps> = ({
  publication,
  wallets = [],
  updateWalletBalance,
  updateAll,
  showCommunityAvatar = false,
  className = '',
}) => {
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
    publication,
    wallets,
    updateWalletBalance,
    updateAll,
  });

  return (
    <article className={`card bg-base-100 shadow-md rounded-lg p-6 ${className}`}>
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
        maxMinus={currentBalance}
      />
    </article>
  );
};
