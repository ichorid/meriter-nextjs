// Publication state management logic
import { useState, useEffect } from 'react';
import { telegramGetAvatarLink, telegramGetAvatarLinkUpd } from '@shared/lib/telegram';
import { useCommunity } from '@/hooks/api';
import { GLOBAL_FEED_TG_CHAT_ID } from '../../config/meriter';

export interface UsePublicationStateProps {
  tgAuthorId?: string;
  authorPhotoUrl?: string;
  tgAuthorName?: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  myId?: string;
  tgChatId?: string;
  showCommunityAvatar?: boolean;
  wallets?: any[];
  balance?: number;
  updBalance?: () => void;
  type?: string;
  content?: any;
  _id?: string;
  onlyPublication?: boolean;
  isDetailPage?: boolean;
  activeCommentHook?: any[];
  dimensions?: any;
  keyword?: string;
  entities?: any;
}

export function usePublicationState({
  tgAuthorId,
  authorPhotoUrl,
  tgAuthorName,
  beneficiaryId,
  beneficiaryName,
  myId,
  tgChatId,
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
}: UsePublicationStateProps) {
  const t = useTranslations('feed');
  
  // State management
  const [showselector, setShowselector] = useState(false);
  const [showDimensionsEditor, setShowDimensionsEditor] = useState(false);
  const [pollUserVote, setPollUserVote] = useState(null);
  const [pollUserVoteSummary, setPollUserVoteSummary] = useState(null);
  const [pollData, setPollData] = useState<any>(type === 'poll' ? content : null);
  
  // Check if current user is the author
  const isAuthor = myId === tgAuthorId;
  
  // Check if there's a beneficiary and it's different from the author
  const hasBeneficiary = beneficiaryId && beneficiaryId !== tgAuthorId;
  
  // Determine the title based on beneficiary
  const displayTitle = hasBeneficiary 
    ? t('forBeneficiary', { author: tgAuthorName, beneficiary: beneficiaryName })
    : tgAuthorName;
  
  // Check if this is a merit post
  const isMerit = tgChatId === GLOBAL_FEED_TG_CHAT_ID;
  
  // Get community info
  const communityId = tgChatId || (type === 'poll' ? content?.communityId : null);
  const { data: communityInfo = {} } = useCommunity(communityId || '');
  
  // Calculate poll balance
  const pollCommunityId = type === 'poll' ? content?.communityId : null;
  let effectiveBalance = balance;
  if (isAuthor && Array.isArray(wallets) && pollCommunityId) {
    const pollWalletBalance = wallets.find((w: any) => w.currencyOfCommunityTgChatId === pollCommunityId)?.amount || 0;
    effectiveBalance = pollWalletBalance;
  } else {
    effectiveBalance = showCommunityAvatar ? 0 : balance;
  }
  
  // Generate avatar URL
  const avatarUrl = authorPhotoUrl || telegramGetAvatarLink(tgAuthorId);
  
  // Handle avatar error
  const handleAvatarError = () => {
    const fallbackUrl = telegramGetAvatarLinkUpd(tgAuthorId);
    if (fallbackUrl !== avatarUrl) {
      // Force re-render with fallback avatar
      const imgElement = document.querySelector(`img[src="${avatarUrl}"]`) as HTMLImageElement;
      if (imgElement) imgElement.src = fallbackUrl;
    }
  };
  
  // Generate tags string
  const tagsStr = [
    "#" + keyword,
    ...(Object.entries(dimensions || {}) || [])
      .map(([slug, dim]) => "#" + dim)
      .flat(),
  ].join(" ");
  
  // Handle poll vote success
  const handlePollVoteSuccess = () => {
    if (type === 'poll' && _id) {
      updBalance && updBalance();
    }
  };
  
  // Handle dimensions editor
  const handleDimensionsClick = () => {
    if (myId == tgAuthorId) {
      setShowDimensionsEditor(true);
    }
  };
  
  return {
    // State
    showselector,
    setShowselector,
    showDimensionsEditor,
    setShowDimensionsEditor,
    pollUserVote,
    setPollUserVote,
    pollUserVoteSummary,
    setPollUserVoteSummary,
    pollData,
    setPollData,
    
    // Calculated values
    isAuthor,
    hasBeneficiary,
    displayTitle,
    isMerit,
    communityInfo,
    effectiveBalance,
    avatarUrl,
    tagsStr,
    
    // Actions
    handleAvatarError,
    handlePollVoteSuccess,
    handleDimensionsClick,
  };
}
