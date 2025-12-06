// Auth React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { User } from '@/types/api-v1';

export const useMe = () => {
  // Always make request - React Query will handle 401 errors correctly
  // The API client sends cookies automatically with withCredentials: true
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authApiV1.getMe(),
    // Use longer staleTime for auth data since it doesn't change frequently during a session
    staleTime: 5 * 60 * 1000, // 5 minutes - auth data stays fresh for 5 minutes
    // Don't refetch on mount if data is fresh - prevents excessive refetches on navigation
    refetchOnMount: false,
    // Don't refetch on reconnect if query failed with 401
    refetchOnReconnect: (query) => {
      const lastError = query.state.error as any;
      if (lastError?.details?.status === 401 || lastError?.code === 'HTTP_401') {
        return false;
      }
      return true;
    },
    // Retry once on 401 to handle cases where cookie was just set
    retry: (failureCount, error: any) => {
      const is401 = error?.details?.status === 401 || error?.code === 'HTTP_401';
      // Don't retry on 401 errors (token is invalid/expired)
      if (is401) return false;
      // Retry other errors up to 1 time
      return failureCount < 1;
    },
  });
};

export const useFakeAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authApiV1.authenticateFakeUser(),
    onSuccess: () => {
      // Invalidate queries but don't refetch immediately
      // Let the redirect and page reload handle the refetch
      // This ensures cookies are properly set before refetching
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all, refetchType: 'none' });
    },
  });
};

export const useFakeSuperadminAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authApiV1.authenticateFakeSuperadmin(),
    onSuccess: () => {
      // Invalidate queries but don't refetch immediately
      // Let the redirect and page reload handle the refetch
      // This ensures cookies are properly set before refetching
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all, refetchType: 'none' });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authApiV1.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
};
