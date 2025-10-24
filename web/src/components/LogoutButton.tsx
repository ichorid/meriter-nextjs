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
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';

interface LogoutButtonProps {
  className?: string;
  showConfirmation?: boolean;
  children?: React.ReactNode;
}

export function LogoutButton({ 
  className = '', 
  showConfirmation = true,
  children 
}: LogoutButtonProps) {
  const router = useRouter();
  const t = useTranslations('shared');
  const { logout, isLoading } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const handleLogout = async () => {
    try {
      await logout();
      // Redirect is handled in the auth context
    } catch (error: any) {
      console.error('Logout failed:', error);
      // Error is handled in the auth context, but we don't re-throw it
      // because we want the logout to complete even if there's an API error
    }
  };
  
  const handleLogoutClick = () => {
    if (showConfirmation) {
      setShowConfirmDialog(true);
    } else {
      handleLogout();
    }
  };
  
  const handleConfirmLogout = () => {
    setShowConfirmDialog(false);
    handleLogout();
  };
  
  const handleCancelLogout = () => {
    setShowConfirmDialog(false);
  };
  
  return (
    <>
      <button
        className={`btn btn-outline btn-sm ${className}`}
        onClick={handleLogoutClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="loading loading-spinner loading-xs"></span>
            {t('loggingOut')}
          </>
        ) : (
          <>
            {children || t('logout')}
          </>
        )}
      </button>
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{t('confirmLogout')}</h3>
            <p className="py-4">{t('confirmLogoutMessage')}</p>
            <div className="modal-action">
              <button 
                className="btn btn-outline"
                onClick={handleCancelLogout}
              >
                {t('cancel')}
              </button>
              <button 
                className="btn btn-error"
                onClick={handleConfirmLogout}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    {t('loggingOut')}
                  </>
                ) : (
                  t('logout')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
