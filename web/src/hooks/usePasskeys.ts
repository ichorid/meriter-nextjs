import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

interface UsePasskeysReturn {
    registerPasskey: (username: string) => Promise<any>;
    loginWithPasskey: (username?: string) => Promise<any>;
    authenticateWithPasskey: () => Promise<{ user: any; isNewUser: boolean }>;
    isWebAuthnSupported: () => boolean;
}

export const usePasskeys = (): UsePasskeysReturn => {

    const isWebAuthnSupported = () => {
        return typeof window !== 'undefined' &&
            window.PublicKeyCredential &&
            typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
    };

    /**
     * Unified Passkey Authentication
     * First tries to authenticate (shows browser Passkey picker)
     * If cancelled/no Passkey, offers registration with UUID username
     */
    const authenticateWithPasskey = async (): Promise<{ user: any; isNewUser: boolean }> => {
        try {
            // Step 1: Try authentication (for existing users)
            const authResp = await fetch('/api/v1/auth/passkey/authenticate/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!authResp.ok) throw new Error('Failed to get authentication options');
            const authOptions = await authResp.json();

            const credential = await startAuthentication(authOptions);

            // Verify authentication
            const verifyResp = await fetch('/api/v1/auth/passkey/authenticate/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credential),
            });

            if (!verifyResp.ok) {
                const errorData = await verifyResp.json().catch(() => ({}));
                throw new Error(errorData.message || 'Authentication failed');
            }

            const result = await verifyResp.json();

            if (!result.success) {
                throw new Error(result.message || 'Authentication failed');
            }

            return {
                user: result.user,
                isNewUser: result.isNewUser || false, // Use backend flag
            };
        } catch (authError: any) {
            // If user cancelled, no Passkey found, OR verification failed (e.g. ghost credential), offer registration
            // This ensures robust handling if the server doesn't recognize the credential
            if (
                authError.name === 'NotAllowedError' ||
                authError.message?.includes('cancelled') ||
                authError.message?.includes('Authentication failed') ||
                authError.message?.includes('Failed to authenticate')
            ) {
                console.log('No Passkey found, creating new one...');

                // Step 2: Registration fallback
                const regResp = await fetch('/api/v1/auth/passkey/register/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: `user_${crypto.randomUUID().split('-')[0]}`
                    }),
                });

                if (!regResp.ok) throw new Error('Failed to get registration options');
                const regOptions = await regResp.json();

                const regCredential = await startRegistration(regOptions);

                // Verify registration
                const verifyResp = await fetch('/api/v1/auth/passkey/register/finish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(regCredential),
                });

                if (!verifyResp.ok) {
                    const errorData = await verifyResp.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Registration failed');
                }

                const result = await verifyResp.json();

                if (!result.success) {
                    throw new Error(result.message || 'Registration failed');
                }

                return {
                    user: result.user,
                    isNewUser: true,
                };
            }

            // Other errors - rethrow
            throw authError;
        }
    };

    const registerPasskey = async (username: string) => {
        if (!username) throw new Error('Username required');

        // 1. Get options from server
        const resp = await fetch('/api/v1/auth/passkey/register/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (!resp.ok) throw new Error('Failed to get registration options');
        const options = await resp.json();

        // 2. Start browser ceremony
        let attResp;
        try {
            attResp = await startRegistration(options);
        } catch (error) {
            throw error;
        }

        // 3. Verify with server
        const verificationResp = await fetch('/api/v1/auth/passkey/register/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attResp),
        });

        if (!verificationResp.ok) throw new Error('Registration verification failed');

        return await verificationResp.json();
    };

    const loginWithPasskey = async (username?: string) => {
        // 1. Get options from server
        const resp = await fetch('/api/v1/auth/passkey/login/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (!resp.ok) throw new Error('Failed to get login options');
        const options = await resp.json();

        // 2. Start browser ceremony
        let asseResp;
        try {
            asseResp = await startAuthentication(options);
        } catch (error) {
            throw error;
        }

        // 3. Verify with server
        const verificationResp = await fetch('/api/v1/auth/passkey/login/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(asseResp),
        });

        if (!verificationResp.ok) throw new Error('Login verification failed');

        return await verificationResp.json();
    };

    return {
        registerPasskey,
        loginWithPasskey,
        authenticateWithPasskey,
        isWebAuthnSupported,
    };
};
