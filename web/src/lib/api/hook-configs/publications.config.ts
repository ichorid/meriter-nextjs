import { queryKeys } from '@/lib/constants/queryKeys';

export const publicationsHookConfig = {
  resourceName: 'publications',
  apiWrapper: 'publicationsApi',
  queryKeys: {
    all: () => queryKeys.publications.all,
    lists: () => queryKeys.publications.lists(),
    list: (params: Record<string, any>) => queryKeys.publications.list(params),
    detail: (id: string) => queryKeys.publications.detail(id),
    my: () => queryKeys.publications.my(),
    myPublications: (params: Record<string, any>) => queryKeys.publications.myPublications(params),
    byCommunity: (communityId: string) => queryKeys.publications.byCommunity(communityId),
  },
  cacheInvalidation: {
    create: ['publications.lists', 'publications.my'],
    update: ['publications.lists', 'publications.detail'],
    delete: ['publications.lists', 'publications.detail', 'publications.my'],
  },
  staleTime: {
    list: 2 * 60 * 1000, // 2 minutes
    detail: 2 * 60 * 1000,
  },
  endpoints: {
    list: {
      method: 'getList',
      params: ['skip', 'limit', 'type', 'communityId', 'userId', 'tag', 'sort', 'order'],
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
    my: {
      method: 'getMy',
      params: ['skip', 'limit', 'userId'],
      custom: true,
    },
    byCommunity: {
      method: 'getByCommunity',
      params: ['communityId', 'params'],
      custom: true,
    },
  },
  validation: {
    detail: true,
    create: true,
  },
};

