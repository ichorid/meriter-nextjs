// Notifications React Query hooks
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { notificationsApiV1 } from "@/lib/api/v1";
import { queryKeys } from "@/lib/constants/queryKeys";
import type { Notification, NotificationPreferences, PaginatedResponse } from "@/types/api-v1";

interface GetNotificationsParams {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
    type?: string;
}

export function useNotifications(params: GetNotificationsParams = {}) {
    return useQuery({
        queryKey: ["notifications", params],
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
        getNextPageParam: (lastPage: PaginatedResponse<Notification>) => {
            if (!lastPage.meta?.pagination?.hasNext) {
                return undefined;
            }
            return (lastPage.meta.pagination.page || 1) + 1;
        },
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
        queryKey: ["notifications", "preferences"],
        queryFn: () => notificationsApiV1.getPreferences(),
    });
}

export function useMarkAsRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (notificationId: string) =>
            notificationsApiV1.markAsRead(notificationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}

export function useMarkAllAsRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => notificationsApiV1.markAllAsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}

export function useDeleteNotification() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (notificationId: string) =>
            notificationsApiV1.deleteNotification(notificationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}

export function useUpdatePreferences() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (preferences: Partial<NotificationPreferences>) =>
            notificationsApiV1.updatePreferences(preferences),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["notifications", "preferences"],
            });
        },
    });
}
