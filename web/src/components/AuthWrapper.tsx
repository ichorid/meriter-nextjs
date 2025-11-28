'use client';

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { InviteEntryForm } from '@/components/InviteEntryForm';
import { LoginForm } from '@/components/LoginForm';
import { VersionDisplay } from '@/components/organisms';
import { LoadingState } from '@/components/atoms/LoadingState';

interface AuthWrapperProps {
  children: React.ReactNode;
  enabledProviders?: string[];
}

// Set to true to disable AuthWrapper temporarily for debugging
const DISABLE_AUTH_WRAPPER = false;

// Enable debug logging only in development
const DEBUG_MODE = process.env.NODE_ENV === 'development';

/**
 * Global Auth Wrapper Component
 * 
 * Checks authentication status via /me request:
 * - If not authenticated: shows login page
 * - If authenticated but no invite used (and no roles): shows invite entry page
 * - If authenticated and valid: shows home or requested page
 */
export function AuthWrapper({ children, enabledProviders }: AuthWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useAuth();
  const renderCount = useRef(0);
  const lastLoggedPathname = useRef<string | null>(null);
  
  if (DEBUG_MODE) {
    renderCount.current += 1;
  }

  // Extract stable user properties for dependency tracking
  const userId = user?.id;
  const userGlobalRole = user?.globalRole;
  const userInviteCode = user?.inviteCode;
  const userMembershipsCount = user?.communityMemberships?.length || 0;

  // Optimized debug logging - only log when meaningful values change
  useEffect(() => {
    if (!DEBUG_MODE) return;

    // Only log when pathname changes or on significant state changes
    const shouldLog = pathname !== lastLoggedPathname.current || renderCount.current === 1;
    
    if (shouldLog) {
      const debugInfo = {
        renderCount: renderCount.current,
        pathname,
        isLoading,
        isAuthenticated,
        hasUser: !!user,
        userId,
        userInviteCode,
        userMemberships: userMembershipsCount,
        userGlobalRole,
        timestamp: new Date().toISOString(),
      };
      
      console.log('[AuthWrapper] Render:', debugInfo);
      lastLoggedPathname.current = pathname;
      
      // Check for potential infinite loop
      if (renderCount.current > 50) {
        console.error('[AuthWrapper] WARNING: Excessive renders detected!', debugInfo);
      }
    }
  }, [pathname, isLoading, isAuthenticated, userId, userGlobalRole, userInviteCode, userMembershipsCount]);

  // If disabled, just render children
  if (DISABLE_AUTH_WRAPPER) {
    if (DEBUG_MODE) {
      console.log('[AuthWrapper] DISABLED - rendering children directly');
    }
    return <>{children}</>;
  }

  // Helper function to check if user needs invite - memoized
  // Superadmins never need invites - they bypass the requirement
  const checkNeedsInvite = useCallback((user: any): boolean => {
    // Superadmins never need invites
    if (user?.globalRole === 'superadmin') {
      return false;
    }
    // Regular users need invite if they have no invite code and no community memberships
    return user && !user.inviteCode && (!user.communityMemberships || user.communityMemberships.length === 0);
  }, []);

  // Memoize needsInvite calculation to avoid recalculating on every render
  const needsInvite = useMemo(() => {
    return checkNeedsInvite(user);
  }, [checkNeedsInvite, userId, userGlobalRole, userInviteCode, userMembershipsCount]);

  // If authenticated and on login page, redirect to home
  useEffect(() => {
    if (isAuthenticated && pathname === '/meriter/login') {
      if (DEBUG_MODE) {
        console.log('[AuthWrapper] Redirect check:', { isAuthenticated, pathname, needsInvite });
      }
      if (!needsInvite) {
        if (DEBUG_MODE) {
          console.log('[AuthWrapper] Redirecting to /meriter/home');
        }
        router.push('/meriter/home');
      }
    }
  }, [isAuthenticated, pathname, router, needsInvite]);

  // If loading, show loading state
  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  // If not authenticated, show login page (regardless of route, unless it's a public API)
  if (!isAuthenticated && !pathname?.startsWith('/api')) {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <LoginForm enabledProviders={enabledProviders} />
            <div className="flex justify-center mt-8">
              <VersionDisplay />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, check if user needs to enter invite
  if (isAuthenticated && needsInvite) {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <InviteEntryForm />
            <div className="flex justify-center mt-8">
              <VersionDisplay />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated and fully registered (or on public route), show children
  return <>{children}</>;
}
