'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMe } from '@/hooks/api/useAuth';
import { Loader2 } from 'lucide-react';
import { isUnauthorizedError } from '@/lib/utils/auth-errors';

/**
 * OAuth Callback Loading Page
 * 
 * This page is used as an intermediate step after OAuth authentication.
 * It solves the SameSite=Lax cookie issue: when OAuth providers redirect
 * cross-site, cookies aren't sent. By redirecting to this same-site page
 * first, the cookie is available for subsequent requests.
 * 
 * The page gently retries users.getMe with exponential backoff until
 * authentication succeeds, then redirects to the final destination.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('common');
  const { data: user, error: userError, isLoading, refetch } = useMe();
  
  const [retryCount, setRetryCount] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const hasRedirectedRef = useRef(false);
  
  // Get returnTo from URL params, default from translations
  const returnTo = searchParams?.get('returnTo') || t('defaultReturnPath');
  
  // Validate returnTo to prevent open redirects
  const sanitizedReturnTo = returnTo.startsWith('/meriter/') || returnTo.startsWith('/')
    ? returnTo
    : t('defaultReturnPath');

  // Maximum retry attempts (10-15 as per plan)
  const MAX_RETRIES = 12;
  
  // Exponential backoff delays: 100ms, 200ms, 400ms, 800ms, 1.6s, 3.2s, then cap at 3.2s
  const getRetryDelay = (attempt: number): number => {
    const baseDelay = 100; // 100ms
    const delay = baseDelay * Math.pow(2, attempt);
    // Cap at 3.2 seconds (3200ms)
    return Math.min(delay, 3200);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle successful authentication
  useEffect(() => {
    if (user && !isUnauthorizedError(userError) && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      // Authentication successful, redirect to final destination
      if (mountedRef.current) {
        router.replace(sanitizedReturnTo);
      }
    }
  }, [user, userError, router, sanitizedReturnTo]);

  // Retry logic with exponential backoff
  useEffect(() => {
    // If we're already authenticated, don't retry
    if (user || hasRedirectedRef.current) {
      return;
    }

    // If initial load is still in progress, wait
    if (isLoading && retryCount === 0) {
      return;
    }

    // If we have an unauthorized error and haven't exceeded max retries, schedule a retry
    if (userError && isUnauthorizedError(userError) && retryCount < MAX_RETRIES) {
      const delay = getRetryDelay(retryCount);
      
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current && !hasRedirectedRef.current) {
          setRetryCount(prev => prev + 1);
          // Manually trigger refetch
          refetch();
        }
      }, delay);
    } else if (userError && retryCount >= MAX_RETRIES) {
      // Max retries reached, redirect to login with error
      if (mountedRef.current && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        router.replace(`/meriter/login?error=${encodeURIComponent('Authentication timeout. Please try logging in again.')}`);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, userError, isLoading, retryCount, refetch, router]);

  // Show loading state
  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-brand-primary mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-base-content mb-2">
          Completing authentication...
        </h1>
        <p className="text-sm text-base-content/70">
          {retryCount > 0 && retryCount < MAX_RETRIES
            ? `Verifying authentication (attempt ${retryCount + 1}/${MAX_RETRIES})...`
            : 'Please wait while we verify your authentication.'}
        </p>
      </div>
    </div>
  );
}

