/**
 * Centralized Authentication Context
 * 
 * Provides a centralized authentication system with:
 * - User state management
 * - Authentication methods (Google OAuth, Fake auth for development)
 * - Token management
 * - Logout functionality
 * - Deep link handling
 */

'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { _useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMe, useFakeAuth, useFakeSuperadminAuth, useLogout, useClearCookies } from '@/hooks/api/useAuth';
import { _trpc } from '@/lib/trpc/client';
import { useDeepLinkHandler } from '@/shared/lib/deep-link-handler';
import { clearAuthStorage, redirectToLogin, clearJwtCookie, setHasPreviousSession } from '@/lib/utils/auth';
import { useToastStore } from '@/shared/stores/toast.store';
import type { User } from '@/types/api-v1';
import type { Router } from 'next/router';
import type { ParsedUrlQuery } from 'querystring';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authenticateFakeUser: () => Promise<void>;
  authenticateFakeSuperadmin: () => Promise<void>;
  logout: () => Promise<void>;
  handleDeepLink: (router: Router, searchParams: ParsedUrlQuery, startParam?: string) => void;
  authError: string | null;
  setAuthError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Export AuthContext for testing purposes
export { AuthContext };

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const _queryClient = useQueryClient();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const last401ErrorRef = useRef<string | null>(null);

  const { data: user, isLoading: userLoading, error: userError } = useMe();
  const fakeAuthMutation = useFakeAuth();
  const fakeSuperadminAuthMutation = useFakeSuperadminAuth();
  const logoutMutation = useLogout();
  const clearCookiesMutation = useClearCookies();
  const tCommon = useTranslations('common');

  const { handleDeepLink } = useDeepLinkHandler(router as unknown as Router, null, undefined);

  // Memoize derived values to prevent unnecessary recalculations
  const isLoading = useMemo(() => userLoading || isAuthenticating, [userLoading, isAuthenticating]);

  // Check if we have a 401 error (unauthorized) - memoized
  const is401Error = useMemo(() => {
    const errorStatus = userError ? ((userError as unknown)?.details?.status || (userError as unknown)?.code) : null;
    return errorStatus === 401 || errorStatus === 'HTTP_401';
  }, [userError]);

  // User is authenticated ONLY if:
  // 1. We have a user object (not null/undefined)
  // 2. There's no error OR the error is not a 401 (401 means not authenticated)
  const isAuthenticated = useMemo(() => !!user && !is401Error, [user, is401Error]);

  const authenticateFakeUser = useCallback(async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      // Clear unknown existing JWT cookies before authentication to ensure clean state
      clearJwtCookie();
      await fakeAuthMutation.mutateAsync();
    } catch {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [fakeAuthMutation]);

  const authenticateFakeSuperadmin = useCallback(async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      // Clear unknown existing JWT cookies before authentication to ensure clean state
      clearJwtCookie();
      await fakeSuperadminAuthMutation.mutateAsync();
    } catch {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [fakeSuperadminAuthMutation]);

  const logout = useCallback(async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await logoutMutation.mutateAsync();

      // Call server-side clear-cookies to ensure HttpOnly cookies are removed
      try {
        await clearCookiesMutation.mutateAsync();
      } catch {
        console.error('Failed to clear server cookies:', e);
      }

      clearAuthStorage();
      redirectToLogin();
    } catch {
      const message = error instanceof Error ? error.message : tCommon('logoutFailed');
      setAuthError(message);

      // Still clear everything and redirect on error
      try {
        await clearCookiesMutation.mutateAsync();
      } catch {
        console.error('Failed to clear server cookies:', e);
      }
      clearAuthStorage();
      redirectToLogin();
    } finally {
      setIsAuthenticating(false);
    }
  }, [logoutMutation]);

  // Memoize setAuthError wrapper to ensure stable reference
  const setAuthErrorMemoized = useCallback((error: string | null) => {
    setAuthError(error);
  }, []);

  // Track successful authentication to distinguish first-time users from returning users
  useEffect(() => {
    if (user && !userError && isAuthenticated) {
      // User successfully authenticated - mark that they have had a session
      setHasPreviousSession();
    }
  }, [user, userError, isAuthenticated]);

  useEffect(() => {
    if (userError) {
      // Check if it's a 401 error - invalid/expired JWT
      const errorStatus = (userError as unknown)?.details?.status || (userError as unknown)?.code;
      if (errorStatus === 401 || errorStatus === 'HTTP_401') {
        // Clear auth storage on 401 errors to allow re-login
        clearAuthStorage();
        setAuthError(null); // Clear error to allow login

        // Call server-side clear-cookies to ensure HttpOnly cookies are removed
        // We use a fire-and-forget approach here to avoid blocking
        clearCookiesMutation.mutateAsync().catch(e => console.error('Failed to clear server cookies on 401:', e));

        // Toast is now handled globally in api/client.ts
        // const currentErrorId = `${errorStatus}-${(userError as unknown)?.message || '401'}`;

        // if (last401ErrorRef.current !== currentErrorId) {
        //   last401ErrorRef.current = currentErrorId;
        //   console.log('Adding toast for 401 error:', currentErrorId);
        //   // addToast('Your session has expired. Please log in again.', 'warning');
        // }
      } else {
        setAuthError(userError.message || 'Authentication error');
        // Reset ref when error is not 401
        last401ErrorRef.current = null;
      }
    } else {
      // Reset ref when there's no error
      last401ErrorRef.current = null;
    }
  }, [userError, addToast]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  // Only recreate when actual values change, not object references
  const contextValue: AuthContextType = useMemo(() => ({
    user: user || null,
    isLoading,
    isAuthenticated,
    authenticateFakeUser,
    authenticateFakeSuperadmin,
    logout,
    handleDeepLink,
    authError,
    setAuthError: setAuthErrorMemoized,
  }), [
    user,
    isLoading,
    isAuthenticated,
    authenticateFakeUser,
    authenticateFakeSuperadmin,
    logout,
    handleDeepLink,
    authError,
    setAuthErrorMemoized,
  ]);

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