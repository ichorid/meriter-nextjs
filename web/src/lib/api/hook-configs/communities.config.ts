import { queryKeys } from '@/lib/constants/queryKeys';

export const communitiesHookConfig = {
  resourceName: 'communities',
  apiWrapper: 'communitiesApi',
  queryKeys: {
    all: () => queryKeys.communities.all,
    lists: () => queryKeys.communities.lists(),
    list: (params: Record<string, any>) => queryKeys.communities.list(params),
    detail: (id: string) => queryKeys.communities.detail(id),
  },
  cacheInvalidation: {
    create: ['communities.all'],
    update: ['communities.all'],
    delete: ['communities.all'],
  },
  staleTime: {
    list: 2 * 60 * 1000, // 2 minutes
    detail: 2 * 60 * 1000,
  },
  endpoints: {
    list: {
      method: 'getList',
      params: ['skip', 'limit'],
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
  },
  customHooks: {
    sync: {
      skip: true, // Manual hook, skip generation
    },
    memo: {
      skip: true, // Manual hook, skip generation
    },
  },
};

