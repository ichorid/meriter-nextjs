// Publication state management logic
import { useState, useEffect } from 'react';
import { useCommunity } from '@/hooks/api';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';

interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  [key: string]: unknown;
}

export interface UsePublicationStateProps {
  authorPhotoUrl?: string;
  authorName?: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  myId?: string;
  communityId?: string;
  showCommunityAvatar?: boolean;
  wallets?: Wallet[];
  balance?: number;
  updBalance?: () => void;
  type?: string;
  content?: unknown;
  _id?: string;
  onlyPublication?: boolean;
  isDetailPage?: boolean;
  activeCommentHook?: [string | null, Dispatch<SetStateAction<string | null>>];
  dimensions?: Record<string, unknown>;
  keyword?: string;
  entities?: Record<string, unknown>;
  meta?: {
    author?: {
      id: string;
      name: string;
      photoUrl?: string;
    };
  };
}

export function usePublicationState({
  authorPhotoUrl,
  authorName,
  beneficiaryId,
  beneficiaryName,
  myId,
  communityId,
  showCommunityAvatar,
  wallets,
  balance,
  updBalance,
  type,
  content,
  _id,
  onlyPublication,
  isDetailPage,
  activeCommentHook,
  dimensions,
  keyword,
  entities,
  meta,
}: UsePublicationStateProps) {
  const t = useTranslations('feed');
  
  // State management
  const [showselector, setShowselector] = useState(false);
  const [showDimensionsEditor, setShowDimensionsEditor] = useState(false);
  const [pollUserCast, setPollUserCast] = useState<string | null>(null);
  const [pollUserCastSummary, setPollUserCastSummary] = useState<string | null>(null);
  const [pollData, setPollData] = useState<unknown>(type === 'poll' ? content : null);
  
  // Get author ID from meta or props
  const authorId = meta?.author?.id;
  
  // Check if current user is the author
  const isAuthor = myId === authorId;
  
  // Check if there's a beneficiary and it's different from the author
  const hasBeneficiary = beneficiaryId && beneficiaryId !== authorId;
  
  // Determine the title based on beneficiary
  const displayTitle = hasBeneficiary 
    ? t('forBeneficiary', { author: authorName || meta?.author?.name || 'Unknown', beneficiary: beneficiaryName })
    : (authorName || meta?.author?.name || 'Unknown');
  
  // Get community info
  const { data: communityInfo } = useCommunity(communityId || '');
  
  // Calculate poll balance
  const pollCommunityId = type === 'poll' ? (content as any)?.communityId : null;
  let calculatedBalance = balance || 0;
  if (isAuthor && Array.isArray(wallets) && pollCommunityId) {
    const pollWalletBalance = wallets.find((w: Wallet) => w.communityId === pollCommunityId)?.balance || 0;
    calculatedBalance = pollWalletBalance;
  } else {
    calculatedBalance = showCommunityAvatar ? 0 : (balance || 0);
  }
  
  // Generate avatar URL
  const avatarUrl = authorPhotoUrl || meta?.author?.photoUrl;
  
  // Generate tags string
  const tagsStr = [
    "#" + keyword,
    ...(Object.entries(dimensions || {}) || [])
      .map(([slug, dim]) => "#" + dim)
      .flat(),
  ].join(" ");
  
  // Handle poll cast success
  const handlePollCastSuccess = () => {
    if (type === 'poll' && _id) {
      updBalance && updBalance();
    }
  };
  
  // Handle dimensions editor
  const handleDimensionsClick = () => {
    if (myId == authorId) {
      setShowDimensionsEditor(true);
    }
  };
  
  return {
    // State
    showselector,
    setShowselector,
    showDimensionsEditor,
    setShowDimensionsEditor,
    pollUserCast,
    setPollUserCast,
    pollUserCastSummary,
    setPollUserCastSummary,
    pollData,
    setPollData,
    
    // Calculated values
    isAuthor,
    hasBeneficiary,
    displayTitle,
    communityInfo,
    calculatedBalance,
    avatarUrl,
    tagsStr,
    
    // Actions
    handlePollCastSuccess,
    handleDimensionsClick,
  };
}
