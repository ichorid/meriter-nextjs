/**
 * Centralized Login Form Component
 * 
 * Handles authentication methods:
 * - Multiple OAuth providers (Google, Yandex, VK, Telegram, Apple, Twitter, Instagram, Sber)
 * - Fake authentication (development mode)
 * - Error handling and loading states
 */

'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingState } from '@/components/atoms/LoadingState';
import { ErrorDisplay } from '@/components/atoms/ErrorDisplay';
import { handleAuthRedirect } from '@/lib/utils/auth';
import { getErrorMessage } from '@/lib/api/errors';
import { authApiV1 } from '@/lib/api/v1';
import { isFakeDataMode, config } from '@/config';
import { OAUTH_PROVIDERS, getOAuthUrl, type OAuthProvider } from '@/lib/utils/oauth-providers';
// Gluestack UI components
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card';
import { Button, ButtonText } from '@/components/ui/button';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';

interface LoginFormProps {
  className?: string;
}

export function LoginForm({ className = '' }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('login');
  const fakeDataMode = isFakeDataMode();
  
  const { 
    authenticateFakeUser,
    isLoading, 
    authError, 
    setAuthError,
  } = useAuth();
  
  // Get return URL
  const returnTo = searchParams?.get('returnTo');

  // Handle fake authentication
  const handleFakeAuth = async () => {
    try {
      await authenticateFakeUser();
      
      handleAuthRedirect(returnTo);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.error('❌ Fake authentication failed:', error);
      setAuthError(message);
    }
  };
  
  // Handle OAuth provider authentication
  const handleOAuthAuth = (providerId: string) => {
    const oauthUrl = getOAuthUrl(providerId, returnTo || undefined);
    window.location.href = oauthUrl;
  };

  // Render OAuth provider icon
  const renderProviderIcon = (provider: OAuthProvider) => {
    const IconComponent = LucideIcons[provider.icon] as React.ComponentType<{ className?: string; size?: number }>;
    if (!IconComponent) {
      // Fallback to a default icon if not found
      return <LucideIcons.LogIn className="w-5 h-5" />;
    }
    return <IconComponent className="w-5 h-5" />;
  };
  
  return (
    <Box width="100%" maxWidth={448} mx="auto">
      <Card>
        <CardHeader>
          <Center>
            <Heading size="xl" textAlign="center">
              {t('title')}
            </Heading>
          </Center>
        </CardHeader>
        
        <CardBody>
          <VStack space="md">
            {authError && (
              <ErrorDisplay
                title="Authentication Error"
                message={authError}
                variant="alert"
              />
            )}
            
            {isLoading && (
              <LoadingState text="Authenticating..." />
            )}
            
            {!isLoading && (
              <VStack space="md">
                {fakeDataMode ? (
                  <VStack space="md" alignItems="center">
                    <Text size="sm" color="$textLight600">
                      Fake Data Mode Enabled
                    </Text>
                    <Button
                      variant="solid"
                      size="lg"
                      width="100%"
                      onPress={handleFakeAuth}
                      isDisabled={isLoading}
                    >
                      <ButtonText>Fake Login</ButtonText>
                    </Button>
                  </VStack>
                ) : (
                  <VStack space="md">
                    <Text size="sm" color="$textLight600" textAlign="center">
                      Sign in to continue
                    </Text>
                    <VStack space="sm">
                      {OAUTH_PROVIDERS.map((provider) => (
                        <Button
                          key={provider.id}
                          variant="outline"
                          size="lg"
                          width="100%"
                          onPress={() => handleOAuthAuth(provider.id)}
                          isDisabled={isLoading}
                        >
                          <HStack space="sm" alignItems="center">
                            <Box>{renderProviderIcon(provider)}</Box>
                            <ButtonText>Sign in with {provider.name}</ButtonText>
                          </HStack>
                        </Button>
                      ))}
                    </VStack>
                  </VStack>
                )}
              </VStack>
            )}
          </VStack>
        </CardBody>
        
        <CardFooter>
          <Center width="100%">
            <Button
              variant="link"
              size="sm"
              onPress={() => router.push('/')}
            >
              <ButtonText>{t('backToHome')}</ButtonText>
            </Button>
          </Center>
        </CardFooter>
      </Card>
    </Box>
  );
}
