import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@/contexts/AuthContext';

export const quotaKeys = {
  quota: (userId?: string, communityId?: string) => ['quota', userId, communityId] as const,
};

export interface UserQuota {
  dailyQuota: number;
  usedToday: number;
  remainingToday: number;
  resetAt: string;
}

export function useUserQuota(communityId?: string) {
  const { user } = useAuth();
  return trpc.wallets.getQuota.useQuery(
    { userId: 'me', communityId: communityId! },
    {
      enabled: !!user?.id && !!communityId,
      refetchOnWindowFocus: false,
      select: (data) => ({
        dailyQuota: data.dailyQuota,
        usedToday: data.used,
        remainingToday: data.remaining,
        resetAt: new Date().toISOString(), // TODO: Get actual reset time from backend
      }),
    }
  );
}

/**
 * Hook to fetch quota for another user (requires appropriate permissions: superadmin or lead in community)
 */
export function useOtherUserQuota(userId: string, communityId?: string) {
  return trpc.wallets.getQuota.useQuery(
    { userId, communityId: communityId! },
    {
      enabled: !!userId && !!communityId,
      refetchOnWindowFocus: false,
      retry: false,
      throwOnError: false, // Don't propagate errors to prevent toasts
      select: (data) => ({
        dailyQuota: data.dailyQuota,
        usedToday: data.used,
        remainingToday: data.remaining,
        resetAt: new Date().toISOString(), // TODO: Get actual reset time from backend
      }),
    }
  );
}

export function useQuotaController() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const updateOptimistic = (communityId: string, delta: number) => {
    if (!user?.id || !communityId) return;
    const key = quotaKeys.quota(user.id, communityId);
    const current = queryClient.getQueryData<UserQuota>(key);
    if (!current) return;
    const next: UserQuota = {
      ...current,
      usedToday: (current.usedToday || 0) + Math.abs(delta),
      remainingToday: Math.max(0, (current.remainingToday || 0) - Math.abs(delta)),
    };
    queryClient.setQueryData(key, next);
  };

  const rollback = (communityId: string, previous?: UserQuota) => {
    if (!user?.id || !communityId || !previous) return;
    queryClient.setQueryData(quotaKeys.quota(user.id, communityId), previous);
  };

  const invalidate = (communityId: string) => {
    if (!user?.id || !communityId) return;
    queryClient.invalidateQueries({ queryKey: quotaKeys.quota(user.id, communityId) });
  };

  return { updateOptimistic, rollback, invalidate };
}

export {};
