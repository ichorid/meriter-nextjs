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
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="btn btn-ghost btn-sm"
    >
      {isLoggingOut ? 'Logging out...' : 'Logout'}
    </button>
  );
}
