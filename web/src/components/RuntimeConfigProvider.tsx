'use client';

import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { getEnabledProviders, getAuthEnv } from '@/lib/utils/oauth-providers';
import { AuthWrapper } from '@/components/AuthWrapper';
import { useMemo, useRef } from 'react';
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

    // Memoize authnEnabled to ensure stable reference
    const authnEnabled = useMemo(
        () => runtimeConfig?.authn?.enabled ?? false,
        [runtimeConfig?.authn?.enabled]
    );

    // Memoize smsEnabled to ensure stable reference
    const smsEnabled = useMemo(
        () => runtimeConfig?.sms?.enabled ?? false,
        [runtimeConfig?.sms?.enabled]
    );

    // Memoize phoneEnabled to ensure stable reference
    const phoneEnabled = useMemo(
        () => runtimeConfig?.phone?.enabled ?? false,
        [runtimeConfig?.phone?.enabled]
    );

    // Memoize emailEnabled to ensure stable reference
    const emailEnabled = useMemo(
        () => runtimeConfig?.email?.enabled ?? false,
        [runtimeConfig?.email?.enabled]
    );

    console.log("RuntimeConfigProvider", runtimeConfig);

    // Store previous array to compare by value and maintain stable reference
    const prevProvidersRef = useRef<string[] | null>(null);

    // Memoize enabled providers using primitive dependencies
    // Compare by serialization to maintain stable array reference when values don't change
    const enabledProviders = useMemo(() => {
        const env = getAuthEnv(runtimeConfig);
        const newProviders = getEnabledProviders(env);

        // Compare by serialization to detect actual changes
        // Sort copies to avoid mutating original arrays
        const newProvidersSerialized = JSON.stringify([...newProviders].sort());
        const prevProvidersSerialized = prevProvidersRef.current
            ? JSON.stringify([...prevProvidersRef.current].sort())
            : null;

        // If values are the same, return previous array reference for stability
        if (prevProvidersSerialized === newProvidersSerialized && prevProvidersRef.current) {
            return prevProvidersRef.current;
        }

        // Values changed, update ref and return new array
        prevProvidersRef.current = newProviders;
        return newProviders;
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
        <AuthWrapper
            enabledProviders={enabledProviders}
            authnEnabled={authnEnabled}
            smsEnabled={smsEnabled}
            phoneEnabled={phoneEnabled}
            emailEnabled={emailEnabled}
        >
            {children}
        </AuthWrapper>
    );
}

