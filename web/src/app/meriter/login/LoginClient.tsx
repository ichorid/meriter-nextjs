'use client';

import { LoginForm } from '@/components/LoginForm';
import { VersionDisplay } from '@/components/organisms';
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { useCaptiveBrowser } from '@/lib/captive-browser';
import { Loader2 } from 'lucide-react';

export default function PageMeriterLogin() {
    // Fetch runtime config (falls back to build-time defaults if API fails)
    const { config: runtimeConfig, isLoading, error } = useRuntimeConfig();

    // Product decision: email magic link is the only login method for now.
    // OAuth / SMS / Call / Passkey are disabled regardless of runtime config.
    const emailEnabled = runtimeConfig?.email?.enabled ?? false;

    const { isCaptive: captiveBrowser } = useCaptiveBrowser();

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
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 px-4 py-12 flex items-center justify-center pt-20">
            <div className="w-full max-w-md">
                <LoginForm
                    enabledProviders={[]}
                    authnEnabled={false}
                    smsEnabled={false}
                    phoneEnabled={false}
                    emailEnabled={emailEnabled}
                    captiveBrowser={captiveBrowser}
                />

                <div className="mt-8 flex justify-center">
                    <VersionDisplay showBuildInfo />
                </div>
            </div>
        </div>
    );
}