/**
 * API Response Type Definitions
 * Replaces 'unknown' types throughout the API client
 */

import type { TelegramUser } from '@/types/telegram';

export type { TelegramUser };

export interface CommunityMember {
  userId: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: Date;
  role: 'member' | 'admin' | 'moderator';
  reputation?: number;
}

export interface LeaderboardEntry {
  userId: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  rank: number;
  publicationCount: number;
  commentCount: number;
}

export interface PollCastResult {
  optionIndex: number;
  totalAmount: number;
  castCount: number;
  percentage?: number;
}

export interface AuthResult {
  user: {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
  };
  hasPendingCommunities: boolean;
}

export interface TransactionData {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  sourceType: 'personal' | 'quota';
  referenceType: string;
  referenceId: string;
  description?: string;
  createdAt: Date;
}

export interface UpdateFrequency {
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
}
