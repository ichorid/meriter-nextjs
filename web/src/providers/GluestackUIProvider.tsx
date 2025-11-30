'use client';

import { createProvider } from '@gluestack-ui/provider';
import { StyledProvider } from '@gluestack-style/react';
import { OverlayProvider } from '@gluestack-ui/overlay';
import { ToastProvider } from '@gluestack-ui/toast';
import { config } from '@gluestack-ui/config';

const GluestackUIStyledProvider = createProvider({ StyledProvider });

export function GluestackUIProvider({ children }: { children: React.ReactNode }) {
  return (
    <GluestackUIStyledProvider config={config}>
      <OverlayProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </OverlayProvider>
    </GluestackUIStyledProvider>
  );
}
