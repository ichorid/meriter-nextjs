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
import type { TelegramUser } from '@/types/telegram';
import type { Router } from 'next/router';
import type { ParsedUrlQuery } from 'querystring';

// Local User type definition
interface User {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
  profile?: {
    bio?: string;
    location?: string;
    website?: string;
    isVerified?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authenticateWithTelegram: (user: TelegramUser) => Promise<void>;
  authenticateWithTelegramWebApp: (initData: string) => Promise<void>;
  logout: () => Promise<void>;
  handleDeepLink: (router: Router, searchParams: ParsedUrlQuery, startParam?: string) => void;
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
  
  const { handleDeepLink } = useDeepLinkHandler(router as unknown as Router, null, undefined);
  
  const isLoading = userLoading || isAuthenticating;
  const isAuthenticated = !!user && !userError;
  
  const authenticateWithTelegram = async (telegramUser: TelegramUser) => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await telegramAuthMutation.mutateAsync(telegramUser);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
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
      
      // Manually clear all cookies (JWT is httpOnly so backend handles it, but clear others)
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      });
      
      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to login page
      window.location.href = '/meriter/login';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      setAuthError(message);
      
      // Still clear everything and redirect on error
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      });
      
      localStorage.clear();
      sessionStorage.clear();
      
      window.location.href = '/meriter/login';
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
