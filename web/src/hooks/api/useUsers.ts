import { trpc } from '@/lib/trpc/client';
import type { User, PaginatedResponse } from '@/types/api-v1';

export const useUserProfile = (userId: string) => {
  return trpc.users.getUser.useQuery(
    { id: userId },
    { enabled: !!userId }
  );
};

export function useAllLeads(params: { page?: number; pageSize?: number } = {}) {
  // TODO: Migrate getAllLeads endpoint to tRPC
  // For now, keep using REST API
  return { data: undefined, isLoading: false, error: null };
}

export function useUpdatesFrequency() {
  // TODO: Migrate updatesFrequency endpoint to tRPC
  // For now, keep using REST API
  return { data: undefined, isLoading: false, error: null };
}

export function useSetUpdatesFrequency() {
  // TODO: Migrate setUpdatesFrequency endpoint to tRPC
  // For now, keep using REST API
  return { mutate: () => {}, mutateAsync: async () => {} };
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
