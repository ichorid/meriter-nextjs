/**
 * Centralized Login Form Component
 * 
 * Handles all authentication methods:
 * - Telegram widget authentication
 * - Telegram Web App authentication
 * - Error handling and loading states
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useBotConfig } from '@/contexts/BotConfigContext';
import { LoadingState } from '@/components/atoms/LoadingState';
import { ErrorDisplay } from '@/components/atoms/ErrorDisplay';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { handleAuthRedirect } from '@/lib/utils/auth';
import { getErrorMessage } from '@/lib/api/errors';
import { authApiV1 } from '@/lib/api/v1';
import { isFakeDataMode } from '@/config';
import type { TelegramUser } from '@/types/telegram';

interface LoginFormProps {
  className?: string;
}

export function LoginForm({ className = '' }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('login');
  const { botUsername } = useBotConfig();
  const { initData, isInTelegram } = useTelegramWebApp();
  const fakeDataMode = isFakeDataMode();
  
  const { 
    authenticateWithTelegram, 
    authenticateWithTelegramWebApp,
    authenticateFakeUser,
    isLoading, 
    authError, 
    setAuthError,
    handleDeepLink 
  } = useAuth();
  
  const [webAppAuthAttempted, setWebAppAuthAttempted] = useState(false);
  const [cookiesCleared, setCookiesCleared] = useState(false);
  const telegramWidgetRef = useRef<HTMLDivElement>(null);
  
  // Get return URL
  const returnTo = searchParams?.get('returnTo');
  
  // Clear old cookies on page load for external browsers (not in Telegram)
  // This handles stale cookies with mismatched attributes from previous sessions
  useEffect(() => {
    if (!isInTelegram && !cookiesCleared && !fakeDataMode) {
      setCookiesCleared(true);
      authApiV1.clearCookies().catch((error) => {
        // Silently fail - cookies may not exist or clearing may fail
        // This is not critical for the login flow
        console.debug('Cookie clearing failed (non-critical):', error);
      });
    }
  }, [isInTelegram, cookiesCleared, fakeDataMode]);
  
  // Auto-authenticate with Telegram Web App (only if not in fake mode)
  useEffect(() => {
    if (!fakeDataMode && isInTelegram && initData && !webAppAuthAttempted) {
      setWebAppAuthAttempted(true);
      
      const performWebAppAuth = async () => {
        try {
          console.log('🚀 Attempting Telegram Web App authentication...');
          await authenticateWithTelegramWebApp(initData);
          
          console.log('✅ Authentication successful, redirecting...');
          handleAuthRedirect(returnTo);
        } catch (error: unknown) {
          const message = getErrorMessage(error);
          console.error('❌ Telegram Web App authentication failed:', error);
          setAuthError(message);
        }
      };
      
      performWebAppAuth();
    }
  }, [fakeDataMode, isInTelegram, initData, webAppAuthAttempted, authenticateWithTelegramWebApp, returnTo, setAuthError]);
  
  // Handle Telegram widget authentication
  const handleTelegramAuth = async (telegramUser: unknown) => {
    try {
      console.log('🚀 Attempting Telegram widget authentication...');
      await authenticateWithTelegram(telegramUser as TelegramUser);
      
      console.log('✅ Authentication successful, redirecting...');
      handleAuthRedirect(returnTo);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('❌ Telegram widget authentication failed:', error);
      setAuthError(message);
    }
  };

  // Handle fake authentication
  const handleFakeAuth = async () => {
    try {
      console.log('🚀 Attempting fake authentication...');
      await authenticateFakeUser();
      
      console.log('✅ Fake authentication successful, redirecting...');
      handleAuthRedirect(returnTo);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('❌ Fake authentication failed:', error);
      setAuthError(message);
    }
  };
  
  // Set up Telegram widget (only if not in fake mode)
  useEffect(() => {
    if (!fakeDataMode && telegramWidgetRef.current && botUsername) {
      // Clear existing widget
      telegramWidgetRef.current.innerHTML = '';
      
      // Create new widget
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      script.async = true;
      
      telegramWidgetRef.current.appendChild(script);
      
      // Set up global callback
      (window as any).onTelegramAuth = handleTelegramAuth;
    }
  }, [fakeDataMode, botUsername, handleTelegramAuth]);
  
  return (
    <div className={`login-form ${className}`}>
      <div className="card bg-base-100 shadow-xl max-w-md mx-auto">
        <div className="card-body">
          <h2 className="card-title justify-center mb-4">
            {t('title')}
          </h2>
          
          {authError && (
            <ErrorDisplay
              title="Authentication Error"
              message={authError}
              variant="alert"
              className="mb-4"
            />
          )}
          
          {isLoading && (
            <LoadingState text="Authenticating..." className="py-8" />
          )}
          
          {!isLoading && (
            <div className="space-y-4">
              {fakeDataMode ? (
                <div className="text-center">
                  <p className="text-sm text-base-content/70 mb-4">
                    Fake Data Mode Enabled
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={handleFakeAuth}
                    disabled={isLoading}
                  >
                    Fake Login
                  </button>
                </div>
              ) : isInTelegram ? (
                <div className="text-center">
                  <p className="text-sm text-base-content/70 mb-4">
                    {t('telegramWebApp.detected')}
                  </p>
                  <LoadingState size="md" />
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-base-content/70 mb-4">
                    {t('telegramWidget.instructions')}
                  </p>
                  <div ref={telegramWidgetRef} className="flex justify-center"></div>
                </div>
              )}
            </div>
          )}
          
          <div className="card-actions justify-center mt-6">
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => router.push('/')}
            >
              {t('backToHome')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
