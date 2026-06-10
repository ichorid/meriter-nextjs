'use client';

import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { AuthWrapper } from '@/components/AuthWrapper';
import { EMAIL_ONLY_LOGIN } from '@/lib/constants/login-methods';
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
    fallbackEnabledProviders: _fallbackEnabledProviders,
    fallbackAuthnEnabled: _fallbackAuthnEnabled,
}: RuntimeConfigProviderProps) {
    // Fetch runtime config (falls back to build-time defaults if API fails)
    const { config: runtimeConfig } = useRuntimeConfig();

    const emailEnabled = useMemo(
        () => runtimeConfig?.email?.enabled ?? false,
        [runtimeConfig?.email?.enabled]
    );

    return (
        <AuthWrapper
            enabledProviders={EMAIL_ONLY_LOGIN.enabledProviders}
            authnEnabled={EMAIL_ONLY_LOGIN.authnEnabled}
            smsEnabled={EMAIL_ONLY_LOGIN.smsEnabled}
            phoneEnabled={EMAIL_ONLY_LOGIN.phoneEnabled}
            emailEnabled={emailEnabled}
        >
            {children}
        </AuthWrapper>
    );
}

