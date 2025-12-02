'use client';

import React, { useEffect } from 'react';
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

  // Check invite status before using
  const { data: invite, isLoading: inviteLoading } = useInviteByCode(inviteCode || '');

  useEffect(() => {
    // Only process invite on the home page
    if (pathname !== '/meriter/home') {
      return;
    }

    // Only process invite if user is authenticated and invite code is present
    if (isAuthenticated && user && inviteCode && invite && !inviteLoading) {
      // Check if invite is already used
      if (invite.isUsed) {
        addToast(t('errors.inviteAlreadyUsed'), 'warning');
        // Redirect to home page without invite parameter
        router.replace('/meriter/home');
        return;
      }

      // Check expiration
      if (invite.expiresAt) {
        const expiresAt = new Date(invite.expiresAt);
        if (expiresAt < new Date()) {
          addToast(t('errors.inviteExpired'), 'error');
          // Redirect to home page without invite parameter
          router.replace('/meriter/home');
          return;
        }
      }

      const processInvite = async () => {
        try {
          const response = await useInviteMutation.mutateAsync(inviteCode);
          addToast(t('inviteUsedSuccess'), 'success');

          // Check for teamGroupId in response and redirect if present
          // The response is the data object itself, not wrapped in 'data' property
          if ((response as any)?.teamGroupId) {
            router.push(`/meriter/communities/${(response as any).teamGroupId}/settings`);
            return;
          }

          // Redirect to home page without invite parameter
          router.replace('/meriter/home');
        } catch (error: any) {
          console.error('Failed to use invite:', error);
          // Extract error message from various possible formats
          const errorMessage = error?.response?.data?.error?.message || 
                               error?.response?.data?.message || 
                               error?.message || 
                               t('errors.inviteUseFailed');
          addToast(errorMessage, 'error');
          
          // Redirect to home page without invite parameter for all errors
          // This prevents infinite retry loop
          router.replace('/meriter/home');
        }
      };

      processInvite();
    }
  }, [isAuthenticated, user, inviteCode, invite, inviteLoading, useInviteMutation, router, addToast, t, pathname]);

  return null; // This component doesn't render anything
}


