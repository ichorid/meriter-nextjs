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

import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe, useFakeAuth, useLogout } from '@/hooks/api/useAuth';
import { useDeepLinkHandler } from '@/shared/lib/deep-link-handler';
import { clearAuthStorage, redirectToLogin, clearJwtCookie } from '@/lib/utils/auth';
import type { User } from '@/types/api-v1';
import type { Router } from 'next/router';
import type { ParsedUrlQuery } from 'querystring';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authenticateFakeUser: () => Promise<void>;
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
  const queryClient = useQueryClient();
  
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  
  const { data: user, isLoading: userLoading, error: userError } = useMe();
  const fakeAuthMutation = useFakeAuth();
  const logoutMutation = useLogout();
  
  const { handleDeepLink } = useDeepLinkHandler(router as unknown as Router, null, undefined);
  
  // Memoize derived values to prevent unnecessary recalculations
  const isLoading = useMemo(() => userLoading || isAuthenticating, [userLoading, isAuthenticating]);
  
  // Check if we have a 401 error (unauthorized) - memoized
  const is401Error = useMemo(() => {
    const errorStatus = userError ? ((userError as any)?.details?.status || (userError as any)?.code) : null;
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
      // Clear any existing JWT cookies before authentication to ensure clean state
      clearJwtCookie();
      await fakeAuthMutation.mutateAsync();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [fakeAuthMutation]);
  
  const logout = useCallback(async () => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      await logoutMutation.mutateAsync();
      
      clearAuthStorage();
      redirectToLogin();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      setAuthError(message);
      
      // Still clear everything and redirect on error
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
  
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    
    if (userError) {
      // Check if it's a 401 error - invalid/expired JWT
      const errorStatus = (userError as any)?.details?.status || (userError as any)?.code;
      if (errorStatus === 401 || errorStatus === 'HTTP_401') {
        // Clear auth storage on 401 errors to allow re-login
        clearAuthStorage();
        setAuthError(null); // Clear error to allow login
        setSessionExpired(true); // Show notification to user
        
        // Auto-dismiss notification after 5 seconds
        timer = setTimeout(() => {
          setSessionExpired(false);
        }, 5000);
      } else {
        setAuthError(userError.message || 'Authentication error');
        setSessionExpired(false);
      }
    } else {
      setSessionExpired(false);
    }
    
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [userError]);
  
  // Memoize context value to prevent unnecessary re-renders of consumers
  // Only recreate when actual values change, not object references
  const contextValue: AuthContextType = useMemo(() => ({
    user: user || null,
    isLoading,
    isAuthenticated,
    authenticateFakeUser,
    logout,
    handleDeepLink,
    authError,
    setAuthError: setAuthErrorMemoized,
  }), [
    user,
    isLoading,
    isAuthenticated,
    authenticateFakeUser,
    logout,
    handleDeepLink,
    authError,
    setAuthErrorMemoized,
  ]);
  
  return (
    <AuthContext.Provider value={contextValue}>
      {sessionExpired && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-fade-in">
          <div className="alert alert-warning shadow-lg">
            <div className="flex-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-bold">Session Expired</h3>
                <div className="text-sm">Your session has expired. Please log in again.</div>
              </div>
            </div>
            <button 
              className="btn btn-sm btn-ghost" 
              onClick={() => setSessionExpired(false)}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}
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
