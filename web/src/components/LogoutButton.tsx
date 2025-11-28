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
import { BrandButton } from '@/components/ui/BrandButton';
import { Loader2 } from 'lucide-react';

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
    <div className="self-start">
      <BrandButton
        variant="outline"
        onClick={handleLogout}
        disabled={isLoggingOut}
        isLoading={isLoggingOut}
        leftIcon={isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
      >
        {isLoggingOut ? 'Logging out...' : 'Logout'}
      </BrandButton>
    </div>
  );
}
