/**
 * Query Keys Factory for React Query
 * Centralizes all query keys for type safety and consistency
 */

import { serializeQueryParams } from '@/lib/utils/queryKeys';

export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    profile: (userId: string) => [...queryKeys.users.all, 'profile', userId] as const,
    updatesFrequency: () => [...queryKeys.users.all, 'updates-frequency'] as const,
    updates: (userId: string, params?: Record<string, any>) => [...queryKeys.users.all, 'updates', userId, serializeQueryParams(params || {})] as const,
  },

  // Publications
  publications: {
    all: ['publications'] as const,
    lists: () => [...queryKeys.publications.all, 'list'] as const,
    list: (params: Record<string, any>) => [...queryKeys.publications.lists(), serializeQueryParams(params)] as const,
    details: () => [...queryKeys.publications.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.publications.details(), id] as const,
    my: () => [...queryKeys.publications.all, 'my'] as const,
    myPublications: (params: Record<string, any>) => [...queryKeys.publications.my(), serializeQueryParams(params)] as const,
    byCommunity: (communityId: string) => [...queryKeys.publications.all, 'community', communityId] as const,
    byCommunityInfinite: (communityId: string, params: { pageSize?: number; sort?: string; order?: string } = {}) => 
      [...queryKeys.publications.byCommunity(communityId), 'infinite', serializeQueryParams(params)] as const,
  },

  // Comments
  comments: {
    all: ['comments'] as const,
    lists: () => [...queryKeys.comments.all, 'list'] as const,
    list: (targetType: string, targetId: string) => [...queryKeys.comments.lists(), targetType, targetId] as const,
    details: () => [...queryKeys.comments.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.comments.details(), id] as const,
    my: (userId: string) => [...queryKeys.comments.all, 'my', userId] as const,
    myComments: (userId: string, params: Record<string, any>) => [...queryKeys.comments.my(userId), serializeQueryParams(params)] as const,
  },

  // Communities
  communities: {
    all: ['communities'] as const,
    lists: () => [...queryKeys.communities.all, 'list'] as const,
    list: (params: Record<string, any>) => [...queryKeys.communities.lists(), serializeQueryParams(params)] as const,
    details: () => [...queryKeys.communities.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.communities.details(), id] as const,
    feed: (communityId: string, params: { pageSize?: number; sort?: string; tag?: string } = {}) => 
      [...queryKeys.communities.detail(communityId), 'feed', serializeQueryParams(params)] as const,
  },

  // Polls
  polls: {
    all: ['polls'] as const,
    lists: () => [...queryKeys.polls.all, 'list'] as const,
    list: (params: Record<string, any>) => [...queryKeys.polls.lists(), serializeQueryParams(params)] as const,
    details: () => [...queryKeys.polls.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.polls.details(), id] as const,
  },

  // Wallet
  wallet: {
    all: ['wallet'] as const,
    wallets: () => [...queryKeys.wallet.all, 'wallets'] as const,
    transactions: () => [...queryKeys.wallet.all, 'transactions'] as const,
    transactionsList: (params: Record<string, any>) => [...queryKeys.wallet.transactions(), serializeQueryParams(params)] as const,
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    updatesFrequency: () => [...queryKeys.settings.all, 'updates-frequency'] as const,
  },
};
