// Transaction entity types
import type { ID, Timestamp } from '../common';

export interface Transaction {
  _id: ID;
  amount: number;
  amountPoints: number;
  directionPlus: boolean;
  comment?: string;
  fromUserTgId?: string;
  fromUserTgName?: string;
  toUserTgId?: string;
  toUserTgName?: string;
  forTransactionId?: ID;
  forPublicationSlug?: string;
  inPublicationSlug?: string;
  publicationSlug?: string;
  currency?: string;
  inMerits?: number;
  currencyOfCommunityTgChatId?: string;
  fromTgChatId?: string;
  tgChatId?: string;
  ts: Timestamp;
  sum?: number;
  plus?: number;
  minus?: number;
  balance?: number;
  updBalance?: () => void;
  reason?: string;
  amountTotal?: number;
}

export interface TransactionCreate {
  amountPoints: number;
  comment?: string;
  directionPlus: boolean;
  forTransactionId?: ID;
  forPublicationSlug?: string;
  inPublicationSlug?: string;
  publicationSlug?: string;
}

export interface TransactionUpdate {
  amount?: number;
  comment?: string;
  directionPlus?: boolean;
}

export interface TransactionSummary {
  totalIn: number;
  totalOut: number;
  netBalance: number;
  transactionCount: number;
  lastTransaction?: Timestamp;
}

