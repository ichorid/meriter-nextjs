import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { usersApiV1 } from "@/lib/api/v1";
import { queryKeys } from "@/lib/constants/queryKeys";
import type { UpdateEvent } from "@/types/updates";
import type { PaginatedResponse } from "@/types/api-v1";

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

// Infinite query for user's updates
export function useInfiniteUpdates(userId: string, pageSize: number = 20) {
    return useInfiniteQuery({
        queryKey: [...queryKeys.users.updates(userId), "infinite", pageSize],
        queryFn: ({
            pageParam = 1,
        }: {
            pageParam: number;
        }): Promise<PaginatedResponse<UpdateEvent>> => {
            const skip = (pageParam - 1) * pageSize;
            return usersApiV1.getUpdates(userId, { skip, limit: pageSize });
        },
        getNextPageParam: (lastPage: PaginatedResponse<UpdateEvent>) => {
            if (!lastPage.meta?.pagination?.hasNext) {
                return undefined;
            }
            return (lastPage.meta.pagination.page || 1) + 1;
        },
        initialPageParam: 1,
        enabled: !!userId,
    });
}
