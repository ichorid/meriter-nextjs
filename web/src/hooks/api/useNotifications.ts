// Notifications React Query hooks
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { notificationsApiV1 } from "@/lib/api/v1";
import { queryKeys } from "@/lib/constants/queryKeys";
import type { Notification, NotificationPreferences, PaginatedResponse } from "@/types/api-v1";
import { createGetNextPageParam } from "@/lib/utils/pagination-utils";
import { createMutation } from "@/lib/api/mutation-factory";

interface GetNotificationsParams {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
    type?: string;
}

export function useNotifications(params: GetNotificationsParams = {}) {
    return useQuery({
        queryKey: queryKeys.notifications.list(params),
        queryFn: () => notificationsApiV1.getNotifications(params),
        refetchInterval: 30000, // Poll every 30 seconds for real-time updates
        retry: false, // Don't retry on 404
        retryOnMount: false, // Don't retry on mount if failed
        throwOnError: false, // Don't show errors for 404
    });
}

export function useInfiniteNotifications(
    params: { unreadOnly?: boolean; type?: string } = {},
    pageSize: number = 20
) {
    return useInfiniteQuery({
        queryKey: [...queryKeys.notifications.lists(), 'infinite', params, pageSize],
        queryFn: ({ pageParam = 1 }: { pageParam: number }) => {
            return notificationsApiV1.getNotifications({
                page: pageParam,
                pageSize,
                unreadOnly: params.unreadOnly,
                type: params.type,
            });
        },
        getNextPageParam: createGetNextPageParam<Notification>(),
        initialPageParam: 1,
        refetchInterval: 30000, // Poll every 30 seconds for real-time updates
        retry: false, // Don't retry on 404
        retryOnMount: false, // Don't retry on mount if failed
        throwOnError: false, // Don't show errors for 404
    });
}

export function useUnreadCount() {
    return useQuery({
        queryKey: queryKeys.notifications.unreadCount(),
        queryFn: () => notificationsApiV1.getUnreadCount(),
        retry: false,
        retryOnMount: false,
        throwOnError: false,
    });
}

export function useNotificationPreferences() {
    return useQuery({
        queryKey: queryKeys.notifications.preferences(),
        queryFn: () => notificationsApiV1.getPreferences(),
    });
}

export const useMarkAsRead = createMutation<void, string>({
    mutationFn: (notificationId) => notificationsApiV1.markAsRead(notificationId),
    errorContext: "Mark as read error",
    invalidations: {
        notifications: true,
    },
});

export const useMarkAllAsRead = createMutation<void, void>({
    mutationFn: () => notificationsApiV1.markAllAsRead(),
    errorContext: "Mark all as read error",
    invalidations: {
        notifications: true,
    },
});

export const useDeleteNotification = createMutation<void, string>({
    mutationFn: (notificationId) => notificationsApiV1.deleteNotification(notificationId),
    errorContext: "Delete notification error",
    invalidations: {
        notifications: true,
    },
});

export const useUpdatePreferences = createMutation<
    NotificationPreferences,
    Partial<NotificationPreferences>
>({
    mutationFn: (preferences) => notificationsApiV1.updatePreferences(preferences),
    errorContext: "Update preferences error",
    onSuccess: (_result, _variables, queryClient) => {
        queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.preferences(),
        });
    },
});
