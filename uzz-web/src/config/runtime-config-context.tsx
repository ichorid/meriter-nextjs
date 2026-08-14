'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { UzzRuntimeConfig } from '@/config/runtime-config';

const RuntimeConfigContext = createContext<UzzRuntimeConfig | null>(null);

export function RuntimeConfigProvider({
  value,
  children,
}: {
  value: UzzRuntimeConfig;
  children: ReactNode;
}) {
  return (
    <RuntimeConfigContext.Provider value={value}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig(): UzzRuntimeConfig {
  const config = useContext(RuntimeConfigContext);
  if (!config) {
    throw new Error('useRuntimeConfig must be used within RuntimeConfigProvider');
  }
  return config;
}
