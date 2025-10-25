// Publication entity types
import type { ID, Timestamp } from '../common';

export interface Publication {
  uid: ID;
  meta: {
    author: {
      name?: string;
      telegramId?: string;
      username?: string;
      photoUrl?: string;
    };
    origin: {
      telegramChatId: string;
      telegramChatName?: string;
      messageId?: number;
    };
    comment: string;
    commentTgEntities?: TelegramEntity[];
    hashtagName?: string;
    hashtagSlug?: string;
    beneficiary?: {
      name?: string;
      telegramId?: string;
      username?: string;
      photoUrl?: string;
    };
    metrics: {
      plus: number;
      minus: number;
      sum: number;
    };
  };
  createdAt: Timestamp;
  type: 'publication' | 'poll';
  content?: any;
  slug?: string;
}

export interface TelegramEntity {
  offset: number;
  length: number;
  type: string;
  url?: string;
  user?: any;
}

export interface PublicationCreate {
  meta: {
    comment: string;
    origin: {
      telegramChatId: string;
      telegramChatName?: string;
      messageId?: number;
    };
    hashtagName?: string;
    hashtagSlug?: string;
    beneficiary?: {
      name?: string;
      telegramId?: string;
      username?: string;
      photoUrl?: string;
    };
  };
  type?: 'publication' | 'poll';
  content?: any;
}

export interface PublicationUpdate {
  meta?: {
    comment?: string;
    hashtagName?: string;
    hashtagSlug?: string;
    beneficiary?: {
      name?: string;
      telegramId?: string;
      username?: string;
      photoUrl?: string;
    };
    metrics?: {
      plus?: number;
      minus?: number;
      sum?: number;
    };
  };
}

export interface Feed {
  publications: Publication[];
  hasMore: boolean;
  total: number;
}