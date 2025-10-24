/**
 * Authentication Guard Component
 * 
 * Protects routes that require authentication and handles:
 * - Authentication state checking
 * - Redirecting to login page
 * - Loading states
 * - Error handling
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
}

export function AuthGuard({ 
  children, 
  fallback,
  redirectTo = '/meriter/login',
  requireAuth = true 
}: AuthGuardProps) {
  const { user, isLoading, isAuthenticated, authError } = useAuth();
  const router = useRouter();
  const [hasChecked, setHasChecked] = useState(false);
  
  useEffect(() => {
    if (!isLoading && hasChecked) {
      if (requireAuth && !isAuthenticated) {
        const currentPath = window.location.pathname;
        const returnTo = encodeURIComponent(currentPath);
        router.push(`${redirectTo}?returnTo=${returnTo}`);
      }
    }
  }, [isAuthenticated, isLoading, hasChecked, requireAuth, redirectTo, router]);
  
  useEffect(() => {
    if (!isLoading) {
      setHasChecked(true);
    }
  }, [isLoading]);
  
  // Show loading state
  if (isLoading || !hasChecked) {
    return fallback || (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }
  
  // Show error state
  if (authError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <div className="alert alert-error max-w-md">
          <div className="flex flex-col">
            <h3 className="font-bold">Authentication Error</h3>
            <p className="text-sm">{authError}</p>
          </div>
        </div>
        <button 
          className="btn btn-primary mt-4"
          onClick={() => router.push('/meriter/login')}
        >
          Go to Login
        </button>
      </div>
    );
  }
  
  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    return null; // Will redirect in useEffect
  }
  
  // Render children if authentication requirements are met
  return <>{children}</>;
}

/**
 * Higher-order component for protecting routes
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<AuthGuardProps, 'children'> = {}
) {
  return function AuthGuardedComponent(props: P) {
    return (
      <AuthGuard {...options}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}

/**
 * Hook for checking authentication status in components
 */
export function useAuthGuard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  
  const requireAuth = () => {
    if (!isLoading && !isAuthenticated) {
      const currentPath = window.location.pathname;
      const returnTo = encodeURIComponent(currentPath);
      router.push(`/meriter/login?returnTo=${returnTo}`);
      return false;
    }
    return isAuthenticated;
  };
  
  return {
    requireAuth,
    isAuthenticated,
    isLoading,
    user,
  };
}
