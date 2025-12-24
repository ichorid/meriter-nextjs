'use client';

import { LoginForm } from '@/components/LoginForm';
import { VersionDisplay } from '@/components/organisms';
import { getEnabledProviders, getAuthEnv } from '@/lib/utils/oauth-providers';
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';

export default function PageMeriterLogin() {
    // Fetch runtime config (falls back to build-time defaults if API fails)
    const { config: runtimeConfig, isLoading, error } = useRuntimeConfig();
    
    // Extract stable primitive values for dependencies to avoid object reference issues
    // React Query might return new object references even when values are the same
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
        const env = getAuthEnv(runtimeConfig ?? null);
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

    // Show loading state while fetching config (optional - config query is fast)
    // But we can still render the form with build-time defaults
    if (isLoading && !runtimeConfig) {
        return (
            <div className="min-h-screen bg-base-100 px-4 py-8 flex items-center justify-center">
                <div className="w-full max-w-md text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-base-content/50 mx-auto mb-4" />
                    <p className="text-sm text-base-content/70">Loading...</p>
                </div>
            </div>
        );
    }

    // Log errors for debugging but don't block rendering
    if (error) {
        console.warn('Failed to load runtime config, using build-time defaults:', error);
    }

    return (
        <div className="min-h-screen bg-base-100 px-4 py-8 flex items-center justify-center">
            <div className="w-full max-w-md">
                <p>login page</p>
                {/* DEBUG SECTION - REMOVE BEFORE PRODUCTION */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mb-4 p-2 bg-error/10 rounded-md border border-error/20">
                        <p><strong>Debug Info:</strong></p>
                        <pre style={{ fontSize: '10px', overflow: 'auto' }}>
                            Enabled Providers: {JSON.stringify(enabledProviders, null, 2)}
                            <br />
                            Authn Enabled: {String(authnEnabled)}
                            <br />
                            Runtime Config: {runtimeConfig ? 'Loaded' : 'Not loaded'}
                            {runtimeConfig && (
                                <>
                                    <br />
                                    OAuth Config: {JSON.stringify(runtimeConfig.oauth, null, 2)}
                                    <br />
                                    Authn Config: {JSON.stringify(runtimeConfig.authn, null, 2)}
                                </>
                            )}
                            {error && (
                                <>
                                    <br />
                                    Config Error: {error.message}
                                </>
                            )}
                        </pre>
                    </div>
                )}
                {/* END DEBUG SECTION */}
                <LoginForm enabledProviders={enabledProviders} authnEnabled={authnEnabled} />

                <div className="mt-8 flex justify-center">
                    <VersionDisplay />
                </div>
            </div>
        </div>
    );
}