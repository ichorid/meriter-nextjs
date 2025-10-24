// Publication entity types
import type { ID, Timestamp } from '../common';
import type { Wallet } from './wallet';

export interface Publication {
  _id: ID;
  slug: string;
  tgChatId: string;
  tgChatName?: string;
  tgMessageId?: number;
  tgAuthorName?: string;
  tgAuthorId?: string;
  authorPhotoUrl?: string;
  beneficiaryName?: string;
  beneficiaryPhotoUrl?: string;
  beneficiaryId?: string;
  beneficiaryUsername?: string;
  messageText: string;
  keyword?: string;
  plus: number;
  minus: number;
  sum: number;
  currency?: string;
  inMerits?: number;
  ts: Timestamp;
  type?: 'post' | 'poll';
  content?: any;
  spaceSlug?: string;
  entities?: TelegramEntity[];
  dimensions?: Record<string, any>;
  dimensionConfig?: Record<string, any>;
  balance?: number;
  updBalance?: () => void;
  highlightTransactionId?: ID;
  onlyPublication?: boolean;
  isDetailPage?: boolean;
  showCommunityAvatar?: boolean;
  wallets?: Wallet[];
  updateWalletBalance?: (currencyOfCommunityTgChatId: string, amountChange: number) => void;
  activeWithdrawPost?: string | null;
  setActiveWithdrawPost?: (postId: string | null) => void;
  activeSlider?: string | null;
  setActiveSlider?: (sliderId: string | null) => void;
  activeCommentHook?: [string | null, (commentId: string | null) => void];
  updateAll?: () => void;
  currencyOfCommunityTgChatId?: string;
  fromTgChatId?: string;
}

export interface TelegramEntity {
  offset: number;
  length: number;
  type: string;
  url?: string;
  user?: any;
}

export interface PublicationCreate {
  messageText: string;
  keyword?: string;
  tgChatId: string;
  tgMessageId?: number;
  type?: 'post' | 'poll';
  content?: any;
}

export interface PublicationUpdate {
  messageText?: string;
  keyword?: string;
  plus?: number;
  minus?: number;
  sum?: number;
}

export interface Feed {
  publications: Publication[];
  hasMore: boolean;
  total: number;
}
