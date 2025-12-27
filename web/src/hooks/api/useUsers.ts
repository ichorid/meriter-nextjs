import { trpc } from '@/lib/trpc/client';

export const useUserProfile = (userId: string) => {
  return trpc.users.getUser.useQuery(
    { id: userId },
    { enabled: !!userId }
  );
};

export function useAllLeads(
  params: { page?: number; pageSize?: number } = {},
  options?: { enabled?: boolean }
) {
  return trpc.users.getAllLeads.useQuery(params, {
    enabled: options?.enabled ?? true,
  });
}

export function useUpdatesFrequency(userId: string = 'me') {
  return trpc.users.getUpdatesFrequency.useQuery(
    { userId },
    { enabled: !!userId }
  );
}

export function useSetUpdatesFrequency() {
  const utils = trpc.useUtils();
  
  return trpc.users.setUpdatesFrequency.useMutation({
    onSuccess: (_, variables) => {
      utils.users.getUpdatesFrequency.invalidate({ userId: variables.userId });
    },
  });
}

// Search users (admin only)
export function useSearchUsers(query: string, limit?: number) {
  return trpc.users.searchUsers.useQuery(
    { query, limit },
    { enabled: query.length >= 2 }
  );
}

// Update global role (admin only)
export function useUpdateGlobalRole() {
  const utils = trpc.useUtils();
  
  return trpc.users.updateGlobalRole.useMutation({
    onSuccess: () => {
      // Invalidate user queries to refresh user data
      utils.users.getUser.invalidate();
      utils.users.searchUsers.invalidate();
    },
  });
}
