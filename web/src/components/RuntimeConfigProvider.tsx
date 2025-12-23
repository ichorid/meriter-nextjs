'use client';

import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { getEnabledProviders, getAuthEnv } from '@/lib/utils/oauth-providers';
import { AuthWrapper } from '@/components/AuthWrapper';
import type { ReactNode } from 'react';

interface RuntimeConfigProviderProps {
    children: ReactNode;
    fallbackEnabledProviders: string[];
    fallbackAuthnEnabled: boolean;
}

/**
 * Provider component that wraps AuthWrapper with runtime config
 * Must be used inside QueryProvider to access TanStack Query
 */
export function RuntimeConfigProvider({
    children,
    fallbackEnabledProviders,
    fallbackAuthnEnabled,
}: RuntimeConfigProviderProps) {
    // Fetch runtime config (falls back to build-time defaults if API fails)
    const { config: runtimeConfig } = useRuntimeConfig();
    
    // Get auth environment with runtime config override
    const env = getAuthEnv(runtimeConfig);
    const enabledProviders = getEnabledProviders(env);
    
    // Get AUTHN enabled from runtime config or fall back to build-time
    const authnEnabled = runtimeConfig?.authn?.enabled ?? fallbackAuthnEnabled;

    return (
        <AuthWrapper enabledProviders={enabledProviders} authnEnabled={authnEnabled}>
            {children}
        </AuthWrapper>
    );
}

