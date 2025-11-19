'use client';

import React from 'react';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
  action,
  className = '',
}) => {
  return (
    <Box py="$12" px="$4" flex={1} justifyContent="center" alignItems="center" minHeight={400}>
      <Center>
        <VStack space="sm" alignItems="center" maxWidth={448}>
          {icon && typeof icon !== 'string' && (
            <Box opacity={0.5} mb="$2">
              {icon}
            </Box>
          )}
          {title && (
            <Text size="md" color="$textLight500" textAlign="center" fontWeight="$normal">
              {title}
            </Text>
          )}
          {message && (
            <Text size="sm" color="$textLight400" textAlign="center">
              {message}
            </Text>
          )}
          {action && <Box mt="$4">{action}</Box>}
        </VStack>
      </Center>
    </Box>
  );
};

