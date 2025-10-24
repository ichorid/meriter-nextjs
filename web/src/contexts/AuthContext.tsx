/**
 * Centralized Authentication Context
 * 
 * Provides a centralized authentication system with:
 * - User state management
 * - Authentication methods (Telegram widget, Web App)
 * - Token management
 * - Logout functionality
 * - Deep link handling
 */

'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe, useTelegramAuth, useTelegramWebAppAuth, useLogout } from '@/hooks/api/useAuth';
import { useDeepLinkHandler } from '@/shared/lib/deep-link-handler';
import type { User } from '@/types/entities';

interface AuthContextType {
  // User state
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Authentication methods
  authenticateWithTelegram: (user: any) => Promise<void>;
  authenticateWithTelegramWebApp: (initData: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Deep link handling
  handleDeepLink: (router: any, searchParams: any, startParam?: string) => void;
  
  // Error handling
  authError: string | null;
  setAuthError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // State
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Queries and mutations
  const { data: user, isLoading: userLoading, error: userError } = useMe();
  const telegramAuthMutation = useTelegramAuth();
  const telegramWebAppAuthMutation = useTelegramWebAppAuth();
  const logoutMutation = useLogout();
  
  // Deep link handler
  const { handleDeepLink } = useDeepLinkHandler(router, null, undefined);
  
  // Computed values
  const isLoading = userLoading || isAuthenticating;
  const isAuthenticated = !!user && !userError;
  
  // Authentication methods
  const authenticateWithTelegram = async (telegramUser: any) => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await telegramAuthMutation.mutateAsync(telegramUser);
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed');
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  const authenticateWithTelegramWebApp = async (initData: string) => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await telegramWebAppAuthMutation.mutateAsync(initData);
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed');
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  const logout = async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await logoutMutation.mutateAsync();
      
      // Clear Telegram SDK storage
      clearTelegramSDKStorage();
      
      // Clear authentication cookies
      clearAuthCookies();
      
      console.log('🔐 AuthContext: Logout successful, redirecting to login');
      console.log('🔐 AuthContext: Current URL before redirect:', window.location.href);
      
      // Use window.location.replace to completely replace the URL and clear any parameters
      window.location.replace('/meriter/login');
      
      console.log('🔐 AuthContext: Redirected to clean login page');
    } catch (error: any) {
      console.error('🔐 AuthContext: Logout error:', error);
      setAuthError(error.message || 'Logout failed');
      
      // Even if logout fails, we should still clear local data and redirect
      console.log('🔐 AuthContext: Proceeding with cleanup and redirect despite error');
      
      // Clear Telegram SDK storage
      clearTelegramSDKStorage();
      
      // Clear authentication cookies
      clearAuthCookies();
      
      // Use window.location.replace to completely replace the URL and clear any parameters
      window.location.replace('/meriter/login');
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  // Handle authentication errors
  useEffect(() => {
    if (userError) {
      setAuthError(userError.message || 'Authentication error');
    }
  }, [userError]);
  
  const contextValue: AuthContextType = {
    user: user || null,
    isLoading,
    isAuthenticated,
    authenticateWithTelegram,
    authenticateWithTelegramWebApp,
    logout,
    handleDeepLink,
    authError,
    setAuthError,
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Clear authentication cookies
 */
function clearAuthCookies(): void {
  try {
    // List of common authentication cookie names
    const authCookieNames = [
      'jwt',
      'auth_token',
      'token',
      'session',
      'auth',
      'user',
      'telegram_auth',
      'meriter_auth'
    ];
    
    // Clear cookies by setting them to expire in the past
    authCookieNames.forEach(cookieName => {
      // Clear for current domain
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      // Clear for parent domain
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      // Clear for subdomain
      const domain = window.location.hostname.split('.').slice(-2).join('.');
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain};`;
      
      console.log('🧹 Cleared auth cookie:', cookieName);
    });
    
    console.log('🧹 All authentication cookies cleared');
  } catch (error) {
    console.warn('⚠️ Failed to clear auth cookies:', error);
  }
}

/**
 * Clear persisted Telegram SDK storage to prevent stale state after logout
 */
function clearTelegramSDKStorage(): void {
  try {
    // Clear localStorage keys used by Telegram SDK
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tma/') || key.includes('telegram') || key.includes('init-data'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🧹 Cleared Telegram SDK storage key:', key);
    });
    
    // Also clear sessionStorage
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('tma/') || key.includes('telegram') || key.includes('init-data'))) {
        sessionKeysToRemove.push(key);
      }
    }
    
    sessionKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
      console.log('🧹 Cleared Telegram SDK session storage key:', key);
    });
  } catch (error) {
    console.warn('⚠️ Failed to clear Telegram SDK storage:', error);
  }
}
