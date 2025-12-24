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
    _fallbackEnabledProviders,
    _fallbackAuthnEnabled,
}: RuntimeConfigProviderProps) {
    // Fetch runtime config (falls back to build-time defaults if API fails)
    const { config: runtimeConfig } = useRuntimeConfig();
    
    // Extract stable primitive values for dependencies to avoid object reference issues
    // React Query might return new object references even when values are the same
    // Extract all oauth boolean values as primitives for stable dependencies
    const oauthGoogle = runtimeConfig?.oauth?.google ?? false;
    const oauthYandex = runtimeConfig?.oauth?.yandex ?? false;
    const oauthVk = runtimeConfig?.oauth?.vk ?? false;
    const oauthTelegram = runtimeConfig?.oauth?.telegram ?? false;
    const oauthApple = runtimeConfig?.oauth?.apple ?? false;
    const oauthTwitter = runtimeConfig?.oauth?.twitter ?? false;
    const oauthInstagram = runtimeConfig?.oauth?.instagram ?? false;
    const oauthSber = runtimeConfig?.oauth?.sber ?? false;
    const oauthMailru = runtimeConfig?.oauth?.mailru ?? false;
    const authnEnabled = runtimeConfig?.authn?.enabled ?? false;
    
    // Memoize enabled providers using primitive dependencies
    // This ensures we only recompute when oauth config values actually change
    const enabledProviders = useMemo(() => {
        const env = getAuthEnv(runtimeConfig);
        return getEnabledProviders(env);
    }, [
        oauthGoogle,
        oauthYandex,
        oauthVk,
        oauthTelegram,
        oauthApple,
        oauthTwitter,
        oauthInstagram,
        oauthSber,
        oauthMailru,
    ]);

    return (
        <AuthWrapper enabledProviders={enabledProviders} authnEnabled={authnEnabled}>
            {children}
        </AuthWrapper>
    );
}
