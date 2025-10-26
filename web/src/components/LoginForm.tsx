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
import { useTelegramConfig } from '@/hooks/useConfig';
import { useAppMode } from '@/contexts/AppModeContext';
import type { TelegramUser } from '@/types/telegram';

interface LoginFormProps {
  className?: string;
}

export function LoginForm({ className = '' }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('login');
  const { botUsername } = useTelegramConfig();
  const { isTelegramMiniApp } = useAppMode();
  
  const { 
    authenticateWithTelegram, 
    authenticateWithTelegramWebApp, 
    isLoading, 
    authError, 
    setAuthError,
    handleDeepLink 
  } = useAuth();
  
  // Telegram Web App state
  const [launchParams, setLaunchParams] = useState<any>(null);
  const [rawData, setRawData] = useState<string | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const [webAppAuthAttempted, setWebAppAuthAttempted] = useState(false);
  
  const telegramWidgetRef = useRef<HTMLDivElement>(null);
  
  // Get return URL
  const returnTo = searchParams.get('returnTo');
  
  // Initialize Telegram Web App state
  useEffect(() => {
    if (isTelegramMiniApp && typeof window !== 'undefined') {
      try {
        const tgWebApp = (window as any).Telegram?.WebApp;
        if (tgWebApp) {
          const initDataUnsafe = tgWebApp.initDataUnsafe || {};
          const startParam = initDataUnsafe.start_param || '';
          
          if (initDataUnsafe) {
            setLaunchParams({ tgWebAppStartParam: startParam });
            setRawData(tgWebApp.initData || null);
            setStartParam(startParam);
            
            console.log('📱 Telegram Web App state initialized:', {
              hasInitData: !!initDataUnsafe,
              startParam
            });
          }
        }
      } catch (error) {
        console.debug('Failed to access Telegram WebApp:', error);
      }
    }
  }, [isTelegramMiniApp]);
  
  // Handle deep links
  useEffect(() => {
    if (startParam && isTelegramMiniApp) {
      // TODO: Fix router type compatibility
      // handleDeepLink(router, searchParams, startParam);
    }
  }, [startParam, isTelegramMiniApp, handleDeepLink, router, searchParams]);
  
  // Auto-authenticate with Telegram Web App
  useEffect(() => {
    if (isTelegramMiniApp && rawData && !webAppAuthAttempted) {
      setWebAppAuthAttempted(true);
      
      const performWebAppAuth = async () => {
        try {
          console.log('🚀 Attempting Telegram Web App authentication...');
          await authenticateWithTelegramWebApp(rawData);
          
          // Redirect after successful authentication
          const redirectUrl = returnTo || '/meriter/home';
          console.log('✅ Authentication successful, redirecting to:', redirectUrl);
          router.push(redirectUrl);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Authentication failed';
          console.error('❌ Telegram Web App authentication failed:', error);
          setAuthError(message);
        }
      };
      
      performWebAppAuth();
    }
  }, [isTelegramMiniApp, rawData, webAppAuthAttempted, authenticateWithTelegramWebApp, returnTo, router, setAuthError]);
  
  // Handle Telegram widget authentication
  const handleTelegramAuth = async (telegramUser: unknown) => {
    try {
      console.log('🚀 Attempting Telegram widget authentication...');
      await authenticateWithTelegram(telegramUser as TelegramUser);
      
      // Redirect after successful authentication
      const redirectUrl = returnTo || '/meriter/home';
      console.log('✅ Authentication successful, redirecting to:', redirectUrl);
      router.push(redirectUrl);
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
            <div className="alert alert-error mb-4">
              <div className="flex flex-col">
                <h3 className="font-bold">Authentication Error</h3>
                <p className="text-sm">{authError}</p>
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <div className="loading loading-spinner loading-lg"></div>
              <span className="ml-2">Authenticating...</span>
            </div>
          )}
          
          {!isLoading && (
            <div className="space-y-4">
              {isTelegramMiniApp ? (
                <div className="text-center">
                  <p className="text-sm text-base-content/70 mb-4">
                    {t('telegramWebApp.detected')}
                  </p>
                  <div className="loading loading-spinner loading-md"></div>
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
