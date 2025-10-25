// Wallet entity types
import type { ID, Timestamp } from '../common';

export interface Wallet {
  uid: ID;
  value: number;
  meta: {
    currencyNames?: Record<string, string>;
    currencyOfCommunityTgChatId?: string;
    telegramUserId?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WalletCreate {
  value: number;
  meta: {
    currencyNames?: Record<string, string>;
    currencyOfCommunityTgChatId?: string;
    telegramUserId?: string;
  };
}

export interface WithdrawRequest {
  amount: number;
  currencyOfCommunityTgChatId: string;
  comment?: string;
}