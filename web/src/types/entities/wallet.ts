// Wallet entity types
import type { ID, Timestamp } from '../common';

export interface Wallet {
  _id: ID;
  amount: number;
  currencyNames: string[];
  currencyOfCommunityTgChatId: string;
  tgUserId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WalletBalance {
  currencyOfCommunityTgChatId: string;
  amount: number;
  currencyName: string;
  currencyIcon?: string;
  communityInfo?: {
    title: string;
    photo?: string;
  };
}

export interface WalletTransaction {
  _id: ID;
  amount: number;
  direction: 'in' | 'out';
  type: 'vote' | 'withdraw' | 'transfer' | 'reward';
  description?: string;
  fromUserId?: ID;
  toUserId?: ID;
  communityId?: string;
  createdAt: Timestamp;
}

export interface WithdrawRequest {
  amount: number;
  currencyOfCommunityTgChatId: string;
  destination?: string;
}

export interface WalletUpdate {
  amount?: number;
  currencyNames?: string[];
}

