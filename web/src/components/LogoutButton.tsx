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
      await logoutMutation.mutateAsync();
      clearAuthStorage();
      redirectToLogin();
    } catch (error: unknown) {
      console.error('Logout failed:', error);
      // Still clear everything and redirect on error
      clearAuthStorage();
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
