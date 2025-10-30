import { useQuery } from '@tanstack/react-query';
import { usersApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { UpdateEvent } from '@/types/updates';
import type { PaginatedResponse } from '@/types/api-v1';

export function useUpdates(
  userId: string,
  params: { skip?: number; limit?: number } = {}
) {
  return useQuery<PaginatedResponse<UpdateEvent>>({
    queryKey: queryKeys.users.updates(userId, params),
    queryFn: () => usersApiV1.getUpdates(userId, params),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

