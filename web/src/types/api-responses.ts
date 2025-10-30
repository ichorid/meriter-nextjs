/**
 * API Response Type Definitions
 * Replaces 'any' types throughout the API client
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

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
    tgUserId: string;
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
