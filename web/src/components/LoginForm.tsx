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
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);
    if (inviteCode.trim()) params.set('invite', inviteCode.trim());
    const oauthUrl = getOAuthUrl(providerId, params.toString() || undefined);
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title')}
          </h1>
          {displayedProviders.length > 0 && !fakeDataMode && (
            <p className="mt-2 text-sm text-gray-600">
              {t('subtitle')}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {/* Invite Code Input */}
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

          {isLoading && (
            <LoadingState text="Authenticating..." />
          )}

          {!isLoading && (
            <div className="space-y-4">
              {fakeDataMode ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
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
                      size="lg"
                      fullWidth
                      onClick={() => handleOAuthAuth(provider.id)}
                      disabled={isLoading}
                      leftIcon={renderProviderIcon(provider)}
                      className="justify-start pl-6"
                    >
                      {t('signInWith', { provider: provider.name })}
                    </BrandButton>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm text-red-600">
                    No authentication providers configured. Please contact administrator.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
