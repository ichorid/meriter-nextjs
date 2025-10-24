// Auth React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import type { User, TelegramUser } from '@/types/entities';
import type { AuthRequest, TelegramAuthRequest } from '@/types/api';

// Query keys
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
} as const;

// Get current user
export function useMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => authApi.getMe(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on auth errors
  });
}

// Authenticate with Telegram widget
export function useTelegramAuth() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (user: TelegramUser) => authApi.authenticateWithTelegram(user),
    onSuccess: (data) => {
      // Store auth token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      // Update user cache
      queryClient.setQueryData(authKeys.me(), data.user);
      
      // Invalidate all queries to refresh data with new auth
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error('Telegram auth error:', error);
    },
  });
}

// Authenticate with Telegram Web App
export function useTelegramWebAppAuth() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (initData: string) => authApi.authenticateWithTelegramWebApp(initData),
    onSuccess: (data) => {
      // Store auth token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      // Update user cache
      queryClient.setQueryData(authKeys.me(), data.user);
      
      // Invalidate all queries to refresh data with new auth
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error('Telegram Web App auth error:', error);
    },
  });
}

// Logout
export function useLogout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // Clear auth token
      localStorage.removeItem('auth_token');
      
      // Clear all cached data
      queryClient.clear();
    },
    onError: (error) => {
      console.error('Logout error:', error);
      // Still clear local data even if server logout fails
      localStorage.removeItem('auth_token');
      queryClient.clear();
    },
  });
}

// Refresh token
export function useRefreshToken() {
  return useMutation({
    mutationFn: () => authApi.refreshToken(),
    onSuccess: (data) => {
      // Store new auth token
      localStorage.setItem('auth_token', data.token);
    },
    onError: (error) => {
      console.error('Token refresh error:', error);
      // Clear auth token on refresh failure
      localStorage.removeItem('auth_token');
    },
  });
}
