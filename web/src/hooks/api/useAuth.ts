// Auth React Query hooks
import React from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { isUnauthorizedError } from '@/lib/utils/auth-errors';
import { authApiV1 } from '@/lib/api/v1';

export const useMe = () => {
  // Use tRPC for getMe - provides automatic type safety
  // Use throwOnError: false to handle errors in AuthContext instead of throwing
  const query = trpc.users.getMe.useQuery(undefined, {
    // Use longer staleTime for auth data since it doesn't change frequently during a session
    staleTime: 5 * 60 * 1000, // 5 minutes - auth data stays fresh for 5 minutes
    // Don't refetch on mount if data is fresh - prevents excessive refetches on navigation
    refetchOnMount: false,
    // Don't throw errors - handle them in AuthContext
    throwOnError: false,
    // Don't refetch on reconnect if query failed with 401
    refetchOnReconnect: (query) => {
      return !isUnauthorizedError(query.state.error);
    },
    // Don't retry on 401 errors (token is invalid/expired)
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error)) return false;
      // Retry other errors up to 1 time
      return failureCount < 1;
    },
    // Suppress error toast for 401 errors - they're expected when not authenticated
    // AuthContext handles 401 errors appropriately
    meta: {
      skipErrorToast: true,
    },
  });

  // DEBUG: Log query state changes
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const prevDataRef = React.useRef(query.data);
    const prevErrorRef = React.useRef(query.error);
    
    React.useEffect(() => {
      if (query.data !== prevDataRef.current) {
        console.log('[AUTH-DEBUG] useMe data changed:', {
          hasUser: !!query.data,
          userId: query.data?.id,
          username: query.data?.username,
          isLoading: query.isLoading,
          isFetching: query.isFetching,
        });
        prevDataRef.current = query.data;
      }
      
      if (query.error !== prevErrorRef.current) {
        console.warn('[AUTH-DEBUG] useMe error:', {
          error: query.error,
          isUnauthorized: isUnauthorizedError(query.error),
          isLoading: query.isLoading,
          isFetching: query.isFetching,
        });
        prevErrorRef.current = query.error;
      }
    }, [query.data, query.error, query.isLoading, query.isFetching]);
  }

  return query;
};

export const useFakeAuth = () => {
  const utils = trpc.useUtils();
  
  return useMutation({
    mutationFn: () => authApiV1.authenticateFakeUser(),
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
  
  return useMutation({
    mutationFn: () => authApiV1.authenticateFakeSuperadmin(),
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
  return useMutation({
    mutationFn: () => authApiV1.clearCookies(),
  });
};
