/**
 * Centralized Logout Button Component
 * 
 * Handles logout functionality with:
 * - Confirmation dialog
 * - Loading states
 * - Error handling
 * - Telegram SDK storage cleanup
 */

'use client';

import React, { useState } from 'react';
import { useLogout } from '@/hooks/api/useAuth';
import { clearAuthStorage, redirectToLogin } from '@/lib/utils/auth';
import { invalidateAuthQueries, clearAllQueries } from '@/lib/utils/query-client-cache';
// Gluestack UI components
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';

export function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Call backend logout to clear server-side cookies
      await logoutMutation.mutateAsync();
      
      // Clear frontend storage and cookies
      clearAuthStorage();
      
      // Clear React Query cache to remove stale auth data
      invalidateAuthQueries();
      clearAllQueries();
      
      // Small delay to ensure cookies are cleared before redirect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      redirectToLogin();
    } catch (error: unknown) {
      console.error('Logout failed:', error);
      // Still clear everything and redirect on error
      clearAuthStorage();
      invalidateAuthQueries();
      clearAllQueries();
      
      // Small delay to ensure cookies are cleared before redirect
      await new Promise(resolve => setTimeout(resolve, 100));
      
      redirectToLogin();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onPress={handleLogout}
      isDisabled={isLoggingOut}
    >
      {isLoggingOut ? (
        <HStack space="sm" alignItems="center">
          <Spinner size="small" />
          <ButtonText>Logging out...</ButtonText>
        </HStack>
      ) : (
        <ButtonText>Logout</ButtonText>
      )}
    </Button>
  );
}
