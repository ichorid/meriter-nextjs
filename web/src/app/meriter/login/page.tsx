import { LoginForm } from '@/components/LoginForm';
import { VersionDisplay } from '@/components/organisms';
import { getEnabledProviders } from '@/lib/utils/oauth-providers';

export default function PageMeriterLogin() {
    // Get enabled providers from env (explicitly accessing process.env for Next.js)
    const env = {
        OAUTH_GOOGLE_ENABLED: process.env.OAUTH_GOOGLE_ENABLED,
        OAUTH_YANDEX_ENABLED: process.env.OAUTH_YANDEX_ENABLED,
        OAUTH_VK_ENABLED: process.env.OAUTH_VK_ENABLED,
        OAUTH_TELEGRAM_ENABLED: process.env.OAUTH_TELEGRAM_ENABLED,
        OAUTH_APPLE_ENABLED: process.env.OAUTH_APPLE_ENABLED,
        OAUTH_TWITTER_ENABLED: process.env.OAUTH_TWITTER_ENABLED,
        OAUTH_INSTAGRAM_ENABLED: process.env.OAUTH_INSTAGRAM_ENABLED,
        OAUTH_SBER_ENABLED: process.env.OAUTH_SBER_ENABLED,
    };
    const enabledProviders = getEnabledProviders(env);

    return (
        <div className="min-h-screen bg-base-100 px-4 py-8 flex items-center justify-center">
            <div className="w-full max-w-md">
                {/* DEBUG SECTION - REMOVE BEFORE PRODUCTION */}
                <div className="mb-4 p-2 bg-error/10 rounded-md border border-error/20">
                    <p><strong>Debug Info:</strong></p>
                    <pre style={{ fontSize: '10px', overflow: 'auto' }}>
                        Enabled: {JSON.stringify(enabledProviders, null, 2)}
                        <br />
                        Google Raw: {process.env.OAUTH_GOOGLE_ENABLED}
                    </pre>
                </div>
                {/* END DEBUG SECTION */}
                <LoginForm enabledProviders={enabledProviders} />

                <div className="mt-8 flex justify-center">
                    <VersionDisplay />
                </div>
            </div>
        </div>
    );
}