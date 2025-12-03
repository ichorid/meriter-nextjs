/**
 * Centralized Login Form Component
 * 
 * Handles authentication methods:
 * - Multiple OAuth providers (Google, Yandex, VK, Telegram, Apple, Twitter, Instagram, Sber)
 * - Fake authentication (development mode)
 * - Error handling and loading states
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingState } from '@/components/atoms/LoadingState';
import { handleAuthRedirect } from '@/lib/utils/auth';
import { getErrorMessage } from '@/lib/api/errors';
import { isFakeDataMode } from '@/config';
import { OAUTH_PROVIDERS, getOAuthUrl, type OAuthProvider } from '@/lib/utils/oauth-providers';
import { BrandButton, BrandInput, BrandFormControl } from '@/components/ui';
import { useToastStore } from '@/shared/stores/toast.store';

interface LoginFormProps {
  className?: string;
  enabledProviders?: string[];
}

export function LoginForm({ className = '', enabledProviders }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('login');
  const tReg = useTranslations('registration');
  const fakeDataMode = isFakeDataMode();

  const {
    authenticateFakeUser,
    isLoading,
    authError,
    setAuthError,
  } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  // Get return URL and invite code from URL
  const returnTo = searchParams?.get('returnTo');
  const inviteCodeFromUrl = searchParams?.get('invite');
  const [inviteCode, setInviteCode] = useState(inviteCodeFromUrl || '');

  // Filter providers if enabledProviders is passed
  const displayedProviders = enabledProviders
    ? OAUTH_PROVIDERS.filter(p => enabledProviders.includes(p.id))
    : OAUTH_PROVIDERS;

  // Show auth error toast when error changes
  useEffect(() => {
    if (authError) {
      addToast(authError, 'error');
    }
  }, [authError, addToast]);

  // Handle fake authentication
  const handleFakeAuth = async () => {
    try {
      await authenticateFakeUser();
      handleAuthRedirect(null, '/meriter/home');
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('❌ Fake authentication failed:', error);
      setAuthError(message);
      addToast(message, 'error');
    }
  };

  // Handle OAuth provider authentication
  const handleOAuthAuth = (providerId: string) => {
    // Construct returnTo path with invite code as query parameter
    // Always use /meriter/home as base path when invite code is present
    let returnToPath = returnTo || '/meriter/home';
    
    // If invite code is present, ensure we redirect to /meriter/home with invite query param
    if (inviteCode.trim()) {
      const url = new URL('/meriter/home', window.location.origin);
      url.searchParams.set('invite', inviteCode.trim());
      // Preserve returnTo as a query param if it was specified and different
      if (returnTo && returnTo !== '/meriter/home') {
        url.searchParams.set('returnTo', returnTo);
      }
      returnToPath = url.pathname + url.search;
    }
    
    const oauthUrl = getOAuthUrl(providerId, returnToPath);
    window.location.href = oauthUrl;
  };

  // Render OAuth provider icon
  const renderProviderIcon = (provider: OAuthProvider) => {
    const IconComponent = LucideIcons[provider.icon] as React.ComponentType<{ className?: string; size?: number }>;
    if (!IconComponent) {
      return <LucideIcons.LogIn className="w-5 h-5" />;
    }
    return <IconComponent className="w-5 h-5" />;
  };

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <div>
        <div className="text-center mt-8 mb-24">
          <h1 className="text-xl font-normal text-gray-900 flex justify-center items-center gap-4">
            <img src="/logo.svg" alt="Logo" className="w-5xl h-5xl" />
            <span>{t('siteTitle')}</span>
          </h1>
        </div>
        <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 text-left mb-6">{t('title')}</h2>
        </div>

        <div className="space-y-4 mb-4">
          {/* Invite Code Input */}
          {/* 
          <BrandFormControl
            label={tReg('inviteCodeLabel')}
            helperText={tReg('inviteDescription')}
          >
            <BrandInput
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder={tReg('inviteCodePlaceholder')}
              autoCapitalize="none"
              autoComplete="off"
            />
          </BrandFormControl>
          */}

          <p className="text-sm text-gray-500 mb-8">{t('subtitle')}</p>

          {isLoading && (
            <LoadingState text="Authenticating..." />
          )}

          {!isLoading && (
            <div className="space-y-4">
              {fakeDataMode ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-base-content bg-warning/10 p-2 rounded-lg border border-warning/20">
                    Fake Data Mode Enabled
                  </p>
                  <BrandButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleFakeAuth}
                    disabled={isLoading}
                  >
                    Fake Login
                  </BrandButton>
                </div>
              ) : displayedProviders.length > 0 ? (
                <div className="space-y-3">
                  {displayedProviders.map((provider) => (
                    <BrandButton
                      key={provider.id}
                      variant="outline"
                      size="md"
                      fullWidth
                      onClick={() => handleOAuthAuth(provider.id)}
                      disabled={isLoading}
                      className="justify-start pl-6"
                    >
                      {t('signInWith', { provider: provider.name })}
                    </BrandButton>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm text-red-600">
                    {t('noAuthenticationProviders')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-8 text-left text-sm text-gray-500">
          {t('hint.agreeToTerms')} <span className="font-medium">{t('hint.termsOfService')}</span> {t('hint.and')} <span className="font-medium">{t('hint.personalData')}</span>
        </div>
      </div>
    </div>
  );
}
