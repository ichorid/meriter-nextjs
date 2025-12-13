// Search React Query hooks
import { useQuery } from '@tanstack/react-query';
import { searchApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
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
  return useQuery({
    queryKey: queryKeys.search.query(params),
    queryFn: () => searchApiV1.search(params),
    enabled: !!(params.query || params.tags?.length || params.authorId || params.communityId),
  });
}

