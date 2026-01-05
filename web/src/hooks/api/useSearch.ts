// Search React Query hooks
import { trpc } from '@/lib/trpc/client';
import type { SearchContentType } from '@/types/api-v1';

interface SearchParams {
  query?: string;
  contentType?: SearchContentType;
  tags?: string[];
  authorId?: string;
  communityId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useSearch(params: SearchParams = {}) {
  return trpc.search.search.useQuery(
    {
      query: params.query,
      contentType: params.contentType,
      tags: params.tags,
      authorId: params.authorId,
      communityId: params.communityId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      pageSize: params.pageSize,
    },
    {
      enabled: !!(params.query || params.tags?.length || params.authorId || params.communityId),
    },
  );
}

