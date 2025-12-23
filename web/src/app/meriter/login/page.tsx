'use client';

import { LoginForm } from '@/components/LoginForm';
import { VersionDisplay } from '@/components/organisms';
import { getEnabledProviders, getAuthEnv } from '@/lib/utils/oauth-providers';
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';

export default function PageMeriterLogin() {
    // Fetch runtime config (falls back to build-time defaults if API fails)
    const { config: runtimeConfig } = useRuntimeConfig();
    
    // Get auth environment with runtime config override
    const env = getAuthEnv(runtimeConfig);
    const enabledProviders = getEnabledProviders(env);
    
    // Get AUTHN enabled from runtime config or fall back to build-time
    const authnEnabled = runtimeConfig?.authn?.enabled ?? 
        (process.env.NEXT_PUBLIC_AUTHN_ENABLED || process.env.AUTHN_ENABLED) === 'true';

    console.log('Enabled providers:', enabledProviders);
    console.log('Authn enabled:', authnEnabled);
    console.log('env:', env);
    console.log('process.env:', process.env);

    return (
        <div className="min-h-screen bg-base-100 px-4 py-8 flex items-center justify-center">
            <div className="w-full max-w-md">
                <p>login page</p>
                {/* DEBUG SECTION - REMOVE BEFORE PRODUCTION */}
                <div className="mb-4 p-2 bg-error/10 rounded-md border border-error/20">
                    <p><strong>Debug Info:</strong></p>
                    <pre style={{ fontSize: '10px', overflow: 'auto' }}>
                        Enabled: {JSON.stringify(enabledProviders, null, 2)}
                        <br />
                        Google Raw: {process.env.OAUTH_GOOGLE_ENABLED}
                        <br />
                        AUTHN_ENABLED Raw: {process.env.AUTHN_ENABLED}
                        <br />
                        authnEnabled: {String(authnEnabled)}
                    </pre>
                </div>
                {/* END DEBUG SECTION */}
                <LoginForm enabledProviders={enabledProviders} authnEnabled={authnEnabled} />

                <div className="mt-8 flex justify-center">
                    <VersionDisplay />
                </div>
            </div>
        </div>
    );
}