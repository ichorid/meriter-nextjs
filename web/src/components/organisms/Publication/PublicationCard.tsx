// Publication card component (presentational)
'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
        // maxMinus is calculated in PublicationActions using quota data
      />
    </article>
  );
};
