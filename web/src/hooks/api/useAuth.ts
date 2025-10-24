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
    mutationFn: (user: TelegramUser) => {
      console.log('🔐 useTelegramAuth: Starting mutation with user:', user);
      return authApi.authenticateWithTelegram(user);
    },
    onSuccess: (data) => {
      console.log('🔐 useTelegramAuth: Mutation successful, received data:', data);
      
      // Store auth token if available
      if (data && data.token && data.token.trim() !== '') {
        console.log('🔐 useTelegramAuth: Storing auth token:', data.token);
        localStorage.setItem('auth_token', data.token);
      } else {
        console.warn('🔐 useTelegramAuth: No token provided by server, authentication may use session-based auth');
      }
      
      // Update user cache
      if (data && data.user) {
        console.log('🔐 useTelegramAuth: Updating user cache:', data.user);
        queryClient.setQueryData(authKeys.me(), data.user);
      } else {
        console.error('🔐 useTelegramAuth: No user found in data:', data);
      }
      
      // Invalidate all queries to refresh data with new auth
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error('🔐 useTelegramAuth: Mutation error:', error);
    },
  });
}

// Authenticate with Telegram Web App
export function useTelegramWebAppAuth() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (initData: string) => authApi.authenticateWithTelegramWebApp(initData),
    onSuccess: (data) => {
      console.log('🔐 useTelegramWebAppAuth: Mutation successful, received data:', data);
      
      // Store auth token if available
      if (data && data.token && data.token.trim() !== '') {
        console.log('🔐 useTelegramWebAppAuth: Storing auth token:', data.token);
        localStorage.setItem('auth_token', data.token);
      } else {
        console.warn('🔐 useTelegramWebAppAuth: No token provided by server, authentication may use session-based auth');
      }
      
      // Update user cache
      if (data && data.user) {
        console.log('🔐 useTelegramWebAppAuth: Updating user cache:', data.user);
        queryClient.setQueryData(authKeys.me(), data.user);
      } else {
        console.error('🔐 useTelegramWebAppAuth: No user found in data:', data);
      }
      
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
      console.log('🔐 useLogout: Logout successful, clearing all auth data');
      
      // Clear auth token
      localStorage.removeItem('auth_token');
      
      // Clear all authentication-related localStorage items
      const authKeys = ['auth_token', 'user', 'auth_user', 'telegram_user', 'jwt'];
      authKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log('🧹 Cleared auth localStorage key:', key);
      });
      
      // Clear all cached data
      queryClient.clear();
      
      // Clear any remaining auth-related data
      clearAllAuthData();
    },
    onError: (error) => {
      console.error('🔐 useLogout: Logout error:', error);
      console.error('🔐 useLogout: Error details:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        data: error?.data
      });
      
      // Still clear local data even if server logout fails
      console.log('🔐 useLogout: Proceeding with local cleanup despite API error');
      localStorage.removeItem('auth_token');
      
      // Clear all authentication-related localStorage items
      const authKeys = ['auth_token', 'user', 'auth_user', 'telegram_user', 'jwt'];
      authKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log('🧹 Cleared auth localStorage key:', key);
      });
      
      queryClient.clear();
      clearAllAuthData();
    },
  });
}

/**
 * Clear all authentication-related data from browser storage
 */
function clearAllAuthData(): void {
  try {
    // Clear all localStorage items that might contain auth data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('auth') || 
        key.includes('token') || 
        key.includes('user') || 
        key.includes('jwt') ||
        key.includes('telegram') ||
        key.includes('tma/') ||
        key.includes('init-data')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🧹 Cleared auth localStorage key:', key);
    });
    
    // Clear all sessionStorage items that might contain auth data
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
        key.includes('auth') || 
        key.includes('token') || 
        key.includes('user') || 
        key.includes('jwt') ||
        key.includes('telegram') ||
        key.includes('tma/') ||
        key.includes('init-data')
      )) {
        sessionKeysToRemove.push(key);
      }
    }
    
    sessionKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
      console.log('🧹 Cleared auth sessionStorage key:', key);
    });
    
    console.log('🧹 All authentication data cleared successfully');
  } catch (error) {
    console.warn('⚠️ Failed to clear all auth data:', error);
  }
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
