import { queryKeys } from '@/lib/constants/queryKeys';

export const commentsHookConfig = {
  resourceName: 'comments',
  apiWrapper: 'commentsApi',
  queryKeys: {
    all: () => queryKeys.comments.all,
    lists: () => queryKeys.comments.lists(),
    list: (params: Record<string, any>) => queryKeys.comments.list(params.targetType, params.targetId),
    detail: (id: string) => queryKeys.comments.detail(id),
    byPublication: (publicationId: string) => queryKeys.comments.list('publication', publicationId),
    byComment: (commentId: string) => queryKeys.comments.list('comment', commentId),
  },
  cacheInvalidation: {
    create: ['comments.all'],
    update: ['comments.lists', 'comments.detail'],
    delete: ['comments.lists', 'comments.detail'],
  },
  staleTime: {
    list: 2 * 60 * 1000, // 2 minutes
    detail: 5 * 60 * 1000, // 5 minutes
  },
  endpoints: {
    list: {
      method: 'getList',
      params: ['skip', 'limit', 'publicationId', 'userId'],
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
    byPublication: {
      method: 'getByPublication',
      params: ['publicationId', 'params'],
      custom: true,
    },
    byComment: {
      method: 'getReplies',
      params: ['commentId', 'params'],
      custom: true,
    },
    details: {
      method: 'getDetails',
      params: ['id'],
      custom: true,
    },
  },
  validation: {
    detail: true,
    create: true,
  },
};

