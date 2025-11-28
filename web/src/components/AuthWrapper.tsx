'use client';

import React, { useEffect, useRef } from 'react';
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
  
  renderCount.current += 1;

  // Detailed debug logging
  useEffect(() => {
    const debugInfo = {
      renderCount: renderCount.current,
      pathname,
      isLoading,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
      userInviteCode: user?.inviteCode,
      userMemberships: user?.communityMemberships?.length || 0,
      userGlobalRole: user?.globalRole,
      timestamp: new Date().toISOString(),
    };
    
    console.log('[AuthWrapper] Render:', debugInfo);
    
    // Check for potential infinite loop
    if (renderCount.current > 50) {
      console.error('[AuthWrapper] WARNING: Excessive renders detected!', debugInfo);
    }
  }, [pathname, isLoading, isAuthenticated, user]);

  // If disabled, just render children
  if (DISABLE_AUTH_WRAPPER) {
    console.log('[AuthWrapper] DISABLED - rendering children directly');
    return <>{children}</>;
  }

  // If authenticated and on login page, redirect to home
  useEffect(() => {
    if (isAuthenticated && pathname === '/meriter/login') {
      const needsInvite = user && !user.inviteCode && (!user.communityMemberships || user.communityMemberships.length === 0) && !user.globalRole;
      console.log('[AuthWrapper] Redirect check:', { isAuthenticated, pathname, needsInvite });
      if (!needsInvite) {
        console.log('[AuthWrapper] Redirecting to /meriter/home');
        router.push('/meriter/home');
      }
    }
  }, [isAuthenticated, pathname, router, user]);

  // If loading, show loading state
  if (isLoading) {
    console.log('[AuthWrapper] Showing loading state');
    return <LoadingState fullScreen />;
  }

  // If not authenticated, show login page (regardless of route, unless it's a public API)
  if (!isAuthenticated && !pathname?.startsWith('/api')) {
    console.log('[AuthWrapper] Not authenticated - showing login page');
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
  const needsInvite = user && !user.inviteCode && (!user.communityMemberships || user.communityMemberships.length === 0) && !user.globalRole;

  if (isAuthenticated && needsInvite) {
    console.log('[AuthWrapper] Authenticated but needs invite - showing invite form');
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
  console.log('[AuthWrapper] Authenticated and registered - rendering children');
  return <>{children}</>;
}
