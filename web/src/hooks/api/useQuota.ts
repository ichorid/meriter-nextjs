import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApiV1 } from '@/lib/api/v1';
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
  return useQuery<UserQuota>({
    queryKey: quotaKeys.quota(user?.id, communityId),
    queryFn: async () => {
      if (!user?.id || !communityId) throw new Error('missing identifiers');
      const quota = await usersApiV1.getUserQuota(user.id, communityId);
      return quota;
    },
    enabled: !!user?.id && !!communityId,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch quota for another user (requires appropriate permissions: superadmin or lead in community)
 */
export function useOtherUserQuota(userId: string, communityId?: string) {
  return useQuery<UserQuota>({
    queryKey: quotaKeys.quota(userId, communityId),
    queryFn: async () => {
      if (!userId || !communityId) throw new Error('missing identifiers');
      const quota = await usersApiV1.getUserQuota(userId, communityId);
      return quota;
    },
    enabled: !!userId && !!communityId,
    refetchOnWindowFocus: false,
  });
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
