'use client';

import React, { useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useInvite, useInviteByCode } from '@/hooks/api/useInvites';
import { useTranslations } from 'next-intl';
import { useToastStore } from '@/shared/stores/toast.store';

/**
 * Component to handle invite code usage after OAuth authentication
 * Should be placed on pages that can receive OAuth redirects
 */
export function InviteHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const useInviteMutation = useInvite();
  const inviteCode = searchParams?.get('invite');
  const t = useTranslations('registration');
  const addToast = useToastStore((state) => state.addToast);

  // Track processed invite codes to prevent duplicate processing
  const processedInvitesRef = useRef<Set<string>>(new Set());

  // Disable query if invite has already been processed
  const shouldQueryInvite = !!inviteCode && !processedInvitesRef.current.has(inviteCode);
  
  // Check invite status before using
  const { data: invite, isLoading: inviteLoading } = useInviteByCode(
    inviteCode || '',
    { enabled: shouldQueryInvite }
  );

  // Helper function to remove invite parameter from URL
  const removeInviteFromUrl = () => {
    if (inviteCode && pathname === '/meriter/profile' && searchParams?.get('invite')) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('invite');
      const newSearch = params.toString();
      const newUrl = newSearch ? `${pathname}?${newSearch}` : pathname;
      router.replace(newUrl);
    }
  };

  useEffect(() => {
    // Only process invite on the profile page
    if (pathname !== '/meriter/profile') {
      return;
    }

    // Early return if no invite code
    if (!inviteCode) {
      return;
    }

    // Early return if invite has already been processed
    if (processedInvitesRef.current.has(inviteCode)) {
      // Clean up URL if invite param is still present
      if (searchParams?.get('invite')) {
        removeInviteFromUrl();
      }
      return;
    }

    // Only process invite if user is authenticated and invite data is available
    if (isAuthenticated && user && invite && !inviteLoading) {
      // Check if invite is already used
      if (invite.isUsed) {
        // Mark as processed before showing toast to prevent duplicate processing
        processedInvitesRef.current.add(inviteCode);
        // Remove invite param from URL immediately
        removeInviteFromUrl();
        // Show toast only once
        addToast(t('errors.inviteAlreadyUsed'), 'warning');
        return;
      }

      // Check expiration
      if (invite.expiresAt) {
        const expiresAt = new Date(invite.expiresAt);
        if (expiresAt < new Date()) {
          // Mark as processed before showing toast
          processedInvitesRef.current.add(inviteCode);
          // Remove invite param from URL immediately
          removeInviteFromUrl();
          // Show toast only once
          addToast(t('errors.inviteExpired'), 'error');
          return;
        }
      }

      // Mark as processing to prevent duplicate processing
      processedInvitesRef.current.add(inviteCode);

      const processInvite = async () => {
        try {
          const response = await useInviteMutation.mutateAsync({ code: inviteCode });
          addToast(t('inviteUsedSuccess'), 'success');

          // Get returnTo before removing invite param
          const returnTo = searchParams?.get('returnTo');

          // Remove invite param from URL
          removeInviteFromUrl();

          // Check for teamGroupId in response and redirect if present
          // The response is the data object itself, not wrapped in 'data' property
          if ((response as any)?.teamGroupId) {
            router.push(`/meriter/communities/${(response as any).teamGroupId}/settings`);
            return;
          }

          // Redirect to returnTo if specified, otherwise to profile page
          const redirectUrl = returnTo && returnTo !== '/meriter/login' ? returnTo : '/meriter/profile';
          router.replace(redirectUrl);
        } catch (error: any) {
          console.error('Failed to use invite:', error);
          // Extract error message from various possible formats
          const errorMessage = error?.response?.data?.error?.message || 
                               error?.response?.data?.message || 
                               error?.message || 
                               t('errors.inviteUseFailed');
          addToast(errorMessage, 'error');
          
          // Get returnTo before removing invite param
          const returnTo = searchParams?.get('returnTo');
          
          // Remove invite param from URL
          removeInviteFromUrl();
          
          // Redirect to returnTo if specified, otherwise to profile page
          // This prevents infinite retry loop
          const redirectUrl = returnTo && returnTo !== '/meriter/login' ? returnTo : '/meriter/profile';
          router.replace(redirectUrl);
        }
      };

      processInvite();
    }
  }, [isAuthenticated, user, inviteCode, invite, inviteLoading, useInviteMutation, router, addToast, t, pathname, searchParams]);

  return null; // This component doesn't render anything
}


