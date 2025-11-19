'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useWallets } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';

export interface EmptyCommunitiesBannerProps {
  className?: string;
}

export const EmptyCommunitiesBanner: React.FC<EmptyCommunitiesBannerProps> = ({
  className = '',
}) => {
  const t = useTranslations('home.emptyCommunities.banner');
  const { isAuthenticated } = useAuth();
  const { data: wallets = [], isLoading } = useWallets();
  
  // Don't show banner if not authenticated, loading, or if user has communities
  if (!isAuthenticated || isLoading || (wallets && wallets.length > 0)) {
    return null;
  }

  return (
    <Box mb="$4">
      <Box bg="$info50" borderWidth={1} borderColor="$info200" borderRadius="$md" p="$4">
        <HStack space="md" alignItems="flex-start">
          <Box>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              style={{ width: 24, height: 24 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </Box>
          <VStack space="xs" flex={1}>
            <Heading size="md" fontWeight="$bold">{t('title')}</Heading>
            <Text size="sm">
              {t('message', { botUsername: '' })}
            </Text>
          </VStack>
        </HStack>
      </Box>
    </Box>
  );
};

