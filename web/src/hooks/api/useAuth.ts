// Auth React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { User } from '@meriter/shared-types';

export const useMe = () => {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authApiV1.getMe(),
  });
};

export const useTelegramAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (telegramUser: any) => authApiV1.authenticateWithTelegramWidget(telegramUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
};

export const useTelegramWebAppAuth = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (initData: string) => authApiV1.authenticateWithTelegramWebApp(initData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
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
