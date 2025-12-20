import { LoginForm } from '@/components/LoginForm';
import { VersionDisplay } from '@/components/organisms';
import { getEnabledProviders, getAuthEnv } from '@/lib/utils/oauth-providers';

export default function PageMeriterLogin() {
    const env = getAuthEnv();
    const enabledProviders = getEnabledProviders(env);
    const authnEnabled = process.env.AUTHN_ENABLED === 'true';

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