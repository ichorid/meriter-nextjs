// Comment entity types
import type { ID, Timestamp } from '../common';
import type { Wallet } from './wallet';

export interface Comment {
  _id: ID;
  transactionId: string;
  publicationSlug: string;
  text: string;
  tgUserId: string;
  tgUsername?: string;
  authorPhotoUrl?: string;
  plus: number;
  minus: number;
  sum: number;
  rating?: number;
  timestamp: Timestamp;
  currency?: string;
  inMerits?: number;
  fromUserTgName?: string;
  fromUserTgId?: string;
  toUserTgName?: string;
  toUserTgId?: string;
  directionPlus?: boolean;
  reason?: string;
  amountTotal?: number;
  inPublicationSlug?: string;
  spaceSlug?: string;
  balance?: number;
  updBalance?: () => void;
  activeCommentHook?: [string | null, (commentId: string | null) => void];
  activeSlider?: string | null;
  setActiveSlider?: (sliderId: string | null) => void;
  myId?: string;
  highlightTransactionId?: ID;
  forTransactionId?: ID;
  wallets?: Wallet[];
  updateWalletBalance?: (currencyOfCommunityTgChatId: string, amountChange: number) => void;
  activeWithdrawPost?: string | null;
  setActiveWithdrawPost?: (postId: string | null) => void;
  updateAll?: () => void;
  currencyOfCommunityTgChatId?: string;
  fromTgChatId?: string;
  tgChatId?: string;
  showCommunityAvatar?: boolean;
  isDetailPage?: boolean;
}

export interface CommentCreate {
  text: string;
  publicationSlug: string;
  amount?: number;
  directionPlus?: boolean;
  forTransactionId?: ID;
  forPublicationSlug?: string;
  inPublicationSlug?: string;
}

export interface CommentUpdate {
  text?: string;
  plus?: number;
  minus?: number;
  sum?: number;
}

export interface Vote {
  commentId: ID;
  userId: ID;
  value: number; // positive or negative
  timestamp: Timestamp;
  amount?: number;
}
