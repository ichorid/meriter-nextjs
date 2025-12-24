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
import { useTranslations } from 'next-intl';
import { useLogout } from '@/hooks/api/useAuth';
import { clearAuthStorage, redirectToLogin } from '@/lib/utils/auth';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2 } from 'lucide-react';

export function LogoutButton() {
  const tCommon = useTranslations('common');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutMutation.mutateAsync();
      clearAuthStorage();
      redirectToLogin();
    } catch {
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
      <Button
        variant="outline"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="rounded-xl active:scale-[0.98]"
      >
        {isLoggingOut && <Loader2 className="w-4 h-4 animate-spin" />}
        {isLoggingOut ? tCommon('loggingOut') : tCommon('logout')}
      </Button>
    </div>
  );
}
