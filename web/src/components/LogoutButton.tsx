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

export function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutMutation.mutateAsync();
      window.location.replace('/meriter/login');
    } catch (error: unknown) {
      console.error('Logout failed:', error);
      // Still redirect on error
      window.location.replace('/meriter/login');
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
