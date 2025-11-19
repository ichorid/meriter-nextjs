'use client';

import React from 'react';
import { Box } from '@gluestack-ui/themed';
import { VStack } from '@gluestack-ui/themed';

// Re-export Card directly
export { Card } from '@gluestack-ui/themed';

// CardHeader, CardBody, CardFooter are not exported from @gluestack-ui/themed
// Create simple wrappers using Box and VStack
export const CardHeader: React.FC<React.ComponentProps<typeof Box>> = ({ children, ...props }) => (
  <Box mb="$4" {...props}>{children}</Box>
);

export const CardBody: React.FC<React.ComponentProps<typeof VStack>> = ({ children, ...props }) => (
  <VStack space="md" flex={1} {...props}>{children}</VStack>
);

export const CardFooter: React.FC<React.ComponentProps<typeof Box>> = ({ children, ...props }) => (
  <Box mt="$4" flexDirection="row" justifyContent="flex-end" {...props}>{children}</Box>
);
