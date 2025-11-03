// Auth React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { TelegramUser } from '@/types/telegram';
import type { User } from '@/types/api-v1';

export const useMe = () => {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authApiV1.getMe(),
    // Don't refetch on reconnect if query failed with 401
    refetchOnReconnect: (query) => {
      const lastError = query.state.error as any;
      if (lastError?.details?.status === 401 || lastError?.code === 'HTTP_401') {
        return false;
      }
      return true;
    },
  });
};

export const useTelegramAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (telegramUser: TelegramUser) => authApiV1.authenticateWithTelegramWidget(telegramUser),
    onSuccess: () => {
      // Invalidate queries but don't refetch immediately
      // Let the redirect and page reload handle the refetch
      // This ensures cookies are properly set before refetching
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all, refetchType: 'none' });
    },
  });
};

export const useTelegramWebAppAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (initData: string) => authApiV1.authenticateWithTelegramWebApp(initData),
    onSuccess: () => {
      // Invalidate queries but don't refetch immediately
      // Let the redirect and page reload handle the refetch
      // This ensures cookies are properly set before refetching
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all, refetchType: 'none' });
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

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authApiV1.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
};
