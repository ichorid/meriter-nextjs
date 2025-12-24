/**
 * Hook Type Definitions
 * Replaces 'unknown' types in hook parameters and return values
 */

import type { Dispatch, SetStateAction } from 'react';

// Local Wallet type definition
interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface UseCommentsParams {
  uid: string;
  publicationSlug: string;
  forTransaction?: boolean;
  transactionId?: string;
  balance?: Wallet | null;
  updBalance?: () => Promise<void>;
  activeCommentHook?: [string | null, Dispatch<SetStateAction<string | null>>];
}

export interface UsePublicationVotingParams {
  wallets?: Wallet[];
}

export interface UsePublicationStateParams extends UsePublicationVotingParams {
  publicationId?: string;
  communityId?: string;
  content?: unknown;
  hashtags?: string[];
  dimensions?: Record<string, unknown>;
  activeCommentHook?: [string | null, Dispatch<SetStateAction<string | null>>];
  entities?: Record<string, unknown>;
}
