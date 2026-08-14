'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useRuntimeConfig } from '@/config/runtime-config-context';
import { trpc, getTrpcClient } from './client';

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const { apiBaseUrl } = useRuntimeConfig();
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => getTrpcClient(apiBaseUrl));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
