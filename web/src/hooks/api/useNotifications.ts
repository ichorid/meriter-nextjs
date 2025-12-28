// Notifications React Query hooks - migrated to tRPC
import { trpc } from "@/lib/trpc/client";
import type { Notification, NotificationPreferences } from "@/types/api-v1";

interface GetNotificationsParams {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
    type?: string;
}

export function useNotifications(params: GetNotificationsParams = {}) {
    return trpc.notifications.getAll.useQuery({
        page: params.page,
        pageSize: params.pageSize,
        unreadOnly: params.unreadOnly,
        type: params.type,
    }, {
        refetchInterval: 30000, // Poll every 30 seconds for real-time updates
        retry: false,
        retryOnMount: false,
        throwOnError: false,
    });
}

export function useInfiniteNotifications(
    params: { unreadOnly?: boolean; type?: string } = {},
    pageSize: number = 20
) {
    return trpc.notifications.getAll.useInfiniteQuery(
        {
            page: 1,
            pageSize,
            unreadOnly: params.unreadOnly,
            type: params.type,
        },
        {
            getNextPageParam: (lastPage) => {
                if (!lastPage || lastPage.total === 0) return undefined;
                const currentPage = lastPage.page || 1;
                const totalPages = Math.ceil(lastPage.total / lastPage.pageSize);
                return currentPage < totalPages ? currentPage + 1 : undefined;
            },
            initialPageParam: 1,
            refetchInterval: 30000, // Poll every 30 seconds for real-time updates
            retry: false,
            retryOnMount: false,
            throwOnError: false,
        }
    );
}

export function useUnreadCount() {
    return trpc.notifications.getUnreadCount.useQuery(undefined, {
        retry: false,
        retryOnMount: false,
        throwOnError: false,
        refetchInterval: 30000,
        refetchIntervalInBackground: true,
    });
}

export function useNotificationPreferences() {
    return trpc.notifications.getPreferences.useQuery(undefined);
}

export const useMarkAsRead = () => {
    const utils = trpc.useUtils();

    return trpc.notifications.markAsRead.useMutation({
        onSuccess: () => {
            // Invalidate notifications lists
            utils.notifications.getAll.invalidate();
            // Explicitly refetch unread count to ensure immediate update
            utils.notifications.getUnreadCount.invalidate();
        },
    });
};

export const useMarkAllAsRead = () => {
    const utils = trpc.useUtils();

    return trpc.notifications.markAllAsRead.useMutation({
        onSuccess: () => {
            utils.notifications.getAll.invalidate();
            utils.notifications.getUnreadCount.invalidate();
        },
    });
};

export const useDeleteNotification = () => {
    const utils = trpc.useUtils();

    return trpc.notifications.delete.useMutation({
        onSuccess: () => {
            utils.notifications.getAll.invalidate();
            utils.notifications.getUnreadCount.invalidate();
        },
    });
};

export const useUpdatePreferences = () => {
    const utils = trpc.useUtils();

    return trpc.notifications.updatePreferences.useMutation({
        onSuccess: () => {
            utils.notifications.getPreferences.invalidate();
        },
    });
};
