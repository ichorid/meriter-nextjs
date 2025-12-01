import { queryKeys } from '@/lib/constants/queryKeys';

export const pollsHookConfig = {
  resourceName: 'polls',
  apiWrapper: 'pollsApi',
  queryKeys: {
    all: () => queryKeys.polls.all,
    lists: () => queryKeys.polls.lists(),
    list: (params: Record<string, any>) => queryKeys.polls.list(params),
    detail: (id: string) => queryKeys.polls.detail(id),
    results: (id: string) => [...queryKeys.polls.all, 'results', id] as const,
  },
  cacheInvalidation: {
    create: ['polls.lists'],
    update: ['polls.lists', 'polls.detail'],
    delete: ['polls.lists', 'polls.detail'],
    cast: ['polls.results', 'polls.lists', 'polls.detail', 'wallet.wallets', 'wallet.balance'],
  },
  optimisticUpdates: {
    cast: {
      type: 'wallet',
      helper: 'updateWalletOptimistically',
      communityIdParam: 'communityId',
      walletAmountParam: 'data.walletAmount',
    },
  },
  staleTime: {
    list: 2 * 60 * 1000, // 2 minutes
    detail: 2 * 60 * 1000,
    results: 1 * 60 * 1000,
  },
  endpoints: {
    list: {
      method: 'getList',
      params: ['skip', 'limit', 'userId'],
    },
    detail: {
      method: 'getById',
      params: ['id'],
    },
    create: {
      method: 'create',
      params: ['data'],
    },
    update: {
      method: 'update',
      params: ['id', 'data'],
    },
    delete: {
      method: 'delete',
      params: ['id'],
    },
    results: {
      method: 'getResults',
      params: ['id'],
      custom: true,
    },
    cast: {
      method: 'cast',
      params: ['id', 'data', 'communityId'],
      custom: true,
    },
  },
};

