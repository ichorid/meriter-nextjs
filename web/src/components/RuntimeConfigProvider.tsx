'use client';

import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { getEnabledProviders, getAuthEnv } from '@/lib/utils/oauth-providers';
import { AuthWrapper } from '@/components/AuthWrapper';
import { useMemo } from 'react';
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
    
    // Memoize enabled providers to prevent infinite re-renders
    // getAuthEnv and getEnabledProviders create new objects/arrays each call
    const enabledProviders = useMemo(() => {
        const env = getAuthEnv(runtimeConfig);
        return getEnabledProviders(env);
    }, [runtimeConfig]);
    
    // Get AUTHN enabled from runtime config only (no fallback to env vars)
    // No need to memoize primitive boolean, but we could if runtimeConfig object reference changes frequently
    const authnEnabled = runtimeConfig?.authn?.enabled ?? false;

    return (
        <AuthWrapper enabledProviders={enabledProviders} authnEnabled={authnEnabled}>
            {children}
        </AuthWrapper>
    );
}

