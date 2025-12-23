// Notifications React Query hooks - migrated to tRPC
import { trpc } from "@/lib/trpc/client";
import type { Notification, NotificationPreferences } from "@/types/api-v1";
import { createGetNextPageParam } from "@/lib/utils/pagination-utils";

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
    });
}

export function useNotificationPreferences() {
    // TODO: Add preferences endpoint to notifications router
    return {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
    };
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
    
    // TODO: Add markAllAsRead endpoint to notifications router
    return {
        mutate: () => {},
        mutateAsync: async () => {},
        isLoading: false,
        isError: false,
        error: null,
    };
};

export const useDeleteNotification = () => {
    const utils = trpc.useUtils();
    
    // TODO: Add delete endpoint to notifications router
    return {
        mutate: () => {},
        mutateAsync: async () => {},
        isLoading: false,
        isError: false,
        error: null,
    };
};

export const useUpdatePreferences = () => {
    const utils = trpc.useUtils();
    
    // TODO: Add updatePreferences endpoint to notifications router
    return {
        mutate: () => {},
        mutateAsync: async () => {},
        isLoading: false,
        isError: false,
        error: null,
    };
};
