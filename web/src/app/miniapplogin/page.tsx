'use client';

/**
 * Mini App Login Page
 * 
 * Dedicated entry point for Telegram Mini App authentication.
 * This page always expects to run in Telegram Mini App context.
 * 
 * Handles:
 * - Auto-authentication using Telegram WebApp initData
 * - Deep link navigation based on start_param
 * - Redirect to appropriate destination after authentication
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { LoadingState } from '@/components/atoms/LoadingState';
import { ErrorDisplay } from '@/components/atoms/ErrorDisplay';
import { getErrorMessage } from '@/lib/api/errors';
import { useDeepLinkHandler } from '@/shared/lib/deep-link-handler';
import type { Router } from 'next/router';
import type { ParsedUrlQuery } from 'querystring';

export default function MiniAppLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initData, isInTelegram, initDataUnsafe } = useTelegramWebApp();
  const { authenticateWithTelegramWebApp, authError, setAuthError, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [authAttempted, setAuthAttempted] = useState(false);

  // Extract start_param from Telegram WebApp initDataUnsafe
  const startParam = initDataUnsafe?.start_param;

  // Create deep link handler with start_param from Telegram WebApp
  // searchParams from Next.js useSearchParams already has a .get() method
  const { handleDeepLink } = useDeepLinkHandler(
    router as unknown as Router,
    searchParams as any,
    startParam
  );

  // Auto-authenticate on page load
  useEffect(() => {
    // Only proceed if we haven't attempted auth yet
    if (authAttempted) return;

    // Check if we're in Telegram Mini App context
    if (!isInTelegram || !initData) {
      console.error('❌ Mini App login page accessed outside Telegram Mini App context');
      setAuthError('This page must be opened from within Telegram Mini App');
      setAuthAttempted(true); // Mark as attempted to prevent retry
      return;
    }

    // Perform authentication
    setAuthAttempted(true);

    const performAuth = async () => {
      try {
        console.log('🚀 Attempting Telegram Mini App authentication...');
        console.log('🔗 Start param:', startParam);
        if (searchParams) {
          const params: string[] = [];
          searchParams.forEach((_, key) => params.push(key));
          console.log('🔗 URL params:', params);
        }
        
        await authenticateWithTelegramWebApp(initData);
        
        console.log('✅ Authentication successful');
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error('❌ Telegram Mini App authentication failed:', error);
        setAuthError(message);
      }
    };

    performAuth();
  }, [authAttempted, isInTelegram, initData, authenticateWithTelegramWebApp, setAuthError, startParam, searchParams]);

  // Handle redirect after successful authentication
  useEffect(() => {
    // Only redirect if authenticated and not currently loading
    if (!isAuthenticated || authLoading || !authAttempted) return;

    console.log('✅ User authenticated, handling redirect...');
    console.log('🔗 Start param for redirect:', startParam);

    // If we have a start_param, use deep link handler
    if (startParam) {
      console.log('🔗 Using deep link handler with start_param:', startParam);
      try {
        handleDeepLink();
        return;
      } catch (error) {
        console.error('❌ Deep link handler failed:', error);
        // Fallback to home if deep link fails
        router.push('/meriter/home');
        return;
      }
    }

    // Check for returnTo parameter
    const returnTo = searchParams?.get('returnTo');
    if (returnTo) {
      console.log('🔗 Redirecting to returnTo:', returnTo);
      router.push(returnTo);
      return;
    }

    // Default redirect to home
    console.log('🔗 No deep link or returnTo, redirecting to home');
    router.push('/meriter/home');
  }, [isAuthenticated, authLoading, authAttempted, startParam, handleDeepLink, router, searchParams]);

  // Show loading state
  if (authLoading || !authAttempted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="text-center">
          <LoadingState text="Authenticating..." size="lg" />
          <p className="mt-4 text-sm text-base-content/70">
            Please wait while we authenticate you...
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
        <div className="w-full max-w-md">
          <ErrorDisplay
            title="Authentication Error"
            message={authError}
            variant="alert"
          />
          <div className="mt-4 text-center">
            <button
              className="btn btn-primary"
              onClick={() => {
                setAuthError(null);
                setAuthAttempted(false);
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // This should not be reached normally, but handle the case
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100">
      <LoadingState text="Redirecting..." size="lg" />
    </div>
  );
}

