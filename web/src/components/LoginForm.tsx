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
  
  const { 
    authenticateWithTelegram, 
    authenticateWithTelegramWebApp, 
    isLoading, 
    authError, 
    setAuthError,
    handleDeepLink 
  } = useAuth();
  
  const [webAppAuthAttempted, setWebAppAuthAttempted] = useState(false);
  const telegramWidgetRef = useRef<HTMLDivElement>(null);
  
  // Get return URL
  const returnTo = searchParams?.get('returnTo');
  
  // Auto-authenticate with Telegram Web App
  useEffect(() => {
    if (isInTelegram && initData && !webAppAuthAttempted) {
      setWebAppAuthAttempted(true);
      
      const performWebAppAuth = async () => {
        try {
          console.log('🚀 Attempting Telegram Web App authentication...');
          await authenticateWithTelegramWebApp(initData);
          
          console.log('✅ Authentication successful, redirecting...');
          handleAuthRedirect(returnTo);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Authentication failed';
          console.error('❌ Telegram Web App authentication failed:', error);
          setAuthError(message);
        }
      };
      
      performWebAppAuth();
    }
  }, [isInTelegram, initData, webAppAuthAttempted, authenticateWithTelegramWebApp, returnTo, setAuthError]);
  
  // Handle Telegram widget authentication
  const handleTelegramAuth = async (telegramUser: unknown) => {
    try {
      console.log('🚀 Attempting Telegram widget authentication...');
      await authenticateWithTelegram(telegramUser as TelegramUser);
      
      console.log('✅ Authentication successful, redirecting...');
      handleAuthRedirect(returnTo);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      console.error('❌ Telegram widget authentication failed:', error);
      setAuthError(message);
    }
  };
  
  // Set up Telegram widget
  useEffect(() => {
    if (telegramWidgetRef.current && botUsername) {
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
  }, [botUsername, handleTelegramAuth]);
  
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
              {isInTelegram ? (
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
