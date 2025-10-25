// Transaction entity types
import type { ID, Timestamp } from '../common';

export interface Transaction {
  uid: ID;
  subjectsActorUris: string[];
  spacesActorUris: string[];
  meta: {
    amounts: {
      total: number;
      free?: number;
      currencyOfCommunityTgChatId?: string;
    };
    comment?: string;
    from?: {
      telegramUserId?: string;
      telegramUserName?: string;
    };
    parentPublicationUri?: string;
    metrics?: {
      plus: number;
      minus: number;
      sum: number;
    };
  };
  type: string;
  createdAt: Timestamp;
}

export interface TransactionCreate {
  subjectsActorUris: string[];
  spacesActorUris: string[];
  meta: {
    amounts: {
      total: number;
      free?: number;
      currencyOfCommunityTgChatId?: string;
    };
    comment?: string;
    from?: {
      telegramUserId?: string;
      telegramUserName?: string;
    };
    parentPublicationUri?: string;
  };
  type: string;
}

export interface TransactionUpdate {
  meta?: {
    amounts?: {
      total?: number;
      free?: number;
      currencyOfCommunityTgChatId?: string;
    };
    comment?: string;
    from?: {
      telegramUserId?: string;
      telegramUserName?: string;
    };
    parentPublicationUri?: string;
    metrics?: {
      plus?: number;
      minus?: number;
      sum?: number;
    };
  };
}