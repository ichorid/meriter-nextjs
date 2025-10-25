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
import type { User } from '@meriter/shared-types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authenticateWithTelegram: (user: any) => Promise<void>;
  authenticateWithTelegramWebApp: (initData: string) => Promise<void>;
  logout: () => Promise<void>;
  handleDeepLink: (router: any, searchParams: any, startParam?: string) => void;
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
  
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const { data: user, isLoading: userLoading, error: userError } = useMe();
  const telegramAuthMutation = useTelegramAuth();
  const telegramWebAppAuthMutation = useTelegramWebAppAuth();
  const logoutMutation = useLogout();
  
  const { handleDeepLink } = useDeepLinkHandler(router, null, undefined);
  
  const isLoading = userLoading || isAuthenticating;
  const isAuthenticated = !!user && !userError;
  
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
      window.location.replace('/meriter/login');
    } catch (error: any) {
      setAuthError(error.message || 'Logout failed');
      window.location.replace('/meriter/login');
    } finally {
      setIsAuthenticating(false);
    }
  };
  
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

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
