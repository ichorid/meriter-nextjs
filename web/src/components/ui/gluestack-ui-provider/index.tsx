'use client';

import React from 'react';
import { StyledProvider } from '@gluestack-style/react';
import { config } from '@gluestack-ui/config';

/**
 * GluestackUIProviderWrapper
 * 
 * Wrapper для Gluestack UI компонентов с правильным StyledProvider.
 */
export function GluestackUIProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StyledProvider config={config}>
      {children}
    </StyledProvider>
  );
}

