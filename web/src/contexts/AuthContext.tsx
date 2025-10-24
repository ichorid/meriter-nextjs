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
      
      // Redirect to login page
      router.push('/meriter/login');
    } catch (error: any) {
      setAuthError(error.message || 'Logout failed');
      throw error;
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
