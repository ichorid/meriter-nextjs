// Auth React Query hooks
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';

export const useMe = () => {
  // Use tRPC for getMe - provides automatic type safety
  return trpc.users.getMe.useQuery(undefined, {
    // Use longer staleTime for auth data since it doesn't change frequently during a session
    staleTime: 5 * 60 * 1000, // 5 minutes - auth data stays fresh for 5 minutes
    // Don't refetch on mount if data is fresh - prevents excessive refetches on navigation
    refetchOnMount: false,
    // Don't refetch on reconnect if query failed with 401
    refetchOnReconnect: (query) => {
      const lastError = query.state.error as any;
      const errorStatus = lastError?.data?.httpStatus || lastError?.details?.status || lastError?.code;
      if (errorStatus === 401 || errorStatus === 'HTTP_401' || errorStatus === 'UNAUTHORIZED') {
        return false;
      }
      return true;
    },
    // Retry once on 401 to handle cases where cookie was just set
    retry: (failureCount, error: any) => {
      const errorStatus = error?.data?.httpStatus || error?.details?.status || error?.code;
      const is401 = errorStatus === 401 || errorStatus === 'HTTP_401' || errorStatus === 'UNAUTHORIZED';
      // Don't retry on 401 errors (token is invalid/expired)
      if (is401) return false;
      // Retry other errors up to 1 time
      return failureCount < 1;
    },
  });
};

export const useFakeAuth = () => {
  const utils = trpc.useUtils();
  
  return trpc.auth.authenticateFake.useMutation({
    onSuccess: () => {
      // Invalidate queries but don't refetch immediately
      // Let the redirect and page reload handle the refetch
      // This ensures cookies are properly set before refetching
      utils.users.getMe.invalidate();
    },
  });
};

export const useFakeSuperadminAuth = () => {
  const utils = trpc.useUtils();
  
  return trpc.auth.authenticateFakeSuperadmin.useMutation({
    onSuccess: () => {
      // Invalidate queries but don't refetch immediately
      // Let the redirect and page reload handle the refetch
      // This ensures cookies are properly set before refetching
      utils.users.getMe.invalidate();
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return trpc.auth.logout.useMutation({
    onSuccess: () => {
      // Clear all queries
      queryClient.clear();
    },
  });
};

export const useClearCookies = () => {
  return trpc.auth.clearCookies.useMutation();
};
