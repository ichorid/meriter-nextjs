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

            if (!authResp.ok) {
                const errorText = await authResp.text();
                console.error('[WebAuthn Auth Start] HTTP error:', authResp.status, errorText);
                throw new Error(`Failed to get authentication options: ${authResp.status}`);
            }
            
            const authOptions = await authResp.json();
            console.log('[WebAuthn Auth Start] Options received:', {
                challenge: authOptions.challenge?.substring(0, 20) + '...',
                rpId: authOptions.rpId,
                allowCredentials: authOptions.allowCredentials?.length || 0,
                userVerification: authOptions.userVerification,
            });

            let credential;
            try {
                // SimpleWebAuthn handles conditional mediation automatically when allowCredentials is empty
                credential = await startAuthentication(authOptions);
                
                console.log('[WebAuthn Auth] Credential created:', {
                    id: credential.id?.substring(0, 20) + '...',
                    type: credential.type,
                    responseType: credential.response ? 'authenticatorAssertionResponse' : 'none',
                });
            } catch (createError: any) {
                console.error('[WebAuthn Auth] create() failed:', {
                    name: createError.name,
                    message: createError.message,
                    stack: createError.stack,
                    errorType: createError instanceof DOMException ? 'DOMException' : typeof createError,
                    options: {
                        rpId: authOptions.rpId,
                        allowCredentialsCount: authOptions.allowCredentials?.length || 0,
                    },
                });
                throw createError;
            }

            // Verify authentication
            const verifyResp = await fetch('/api/v1/auth/passkey/authenticate/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credential),
            });

            if (!verifyResp.ok) {
                const errorData = await verifyResp.json().catch(() => ({}));
                console.error('[WebAuthn Auth Finish] Verification failed:', {
                    status: verifyResp.status,
                    error: errorData,
                });
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
            // Enhanced error logging
            console.error('[WebAuthn Auth] Error details:', {
                name: authError.name,
                message: authError.message,
                stack: authError.stack,
                errorType: authError instanceof DOMException ? 'DOMException' : typeof authError,
            });

            // If user cancelled, no Passkey found, OR verification failed (e.g. ghost credential), offer registration
            // This ensures robust handling if the server doesn't recognize the credential
            if (
                authError.name === 'NotAllowedError' ||
                authError.name === 'InvalidStateError' ||
                authError.message?.includes('cancelled') ||
                authError.message?.includes('Authentication failed') ||
                authError.message?.includes('Failed to authenticate')
            ) {
                console.log('[WebAuthn] Falling back to registration...');

                // Step 2: Registration fallback
                const regResp = await fetch('/api/v1/auth/passkey/register/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: `user_${crypto.randomUUID().split('-')[0]}`
                    }),
                });

                if (!regResp.ok) {
                    const errorText = await regResp.text();
                    console.error('[WebAuthn Reg Start] HTTP error:', regResp.status, errorText);
                    throw new Error('Failed to get registration options');
                }
                
                const regOptions = await regResp.json();
                console.log('[WebAuthn Reg Start] Options received:', {
                    challenge: regOptions.challenge?.substring(0, 20) + '...',
                    rpId: regOptions.rpId,
                    rpName: regOptions.rp?.name,
                    userVerification: regOptions.authenticatorSelection?.userVerification,
                    authenticatorAttachment: regOptions.authenticatorSelection?.authenticatorAttachment,
                    residentKey: regOptions.authenticatorSelection?.residentKey,
                });

                let regCredential;
                try {
                    regCredential = await startRegistration(regOptions);
                    console.log('[WebAuthn Reg] Credential created:', {
                        id: regCredential.id?.substring(0, 20) + '...',
                        type: regCredential.type,
                    });
                } catch (regError: any) {
                    console.error('[WebAuthn Reg] create() failed:', {
                        name: regError.name,
                        message: regError.message,
                        stack: regError.stack,
                        errorType: regError instanceof DOMException ? 'DOMException' : typeof regError,
                        options: {
                            rpId: regOptions.rpId,
                            authenticatorAttachment: regOptions.authenticatorSelection?.authenticatorAttachment,
                        },
                    });
                    throw regError;
                }

                // Verify registration
                const verifyResp = await fetch('/api/v1/auth/passkey/register/finish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(regCredential),
                });

                if (!verifyResp.ok) {
                    const errorData = await verifyResp.json().catch(() => ({}));
                    console.error('[WebAuthn Reg Finish] Verification failed:', {
                        status: verifyResp.status,
                        error: errorData,
                    });
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

        if (!resp.ok) {
            const errorText = await resp.text();
            console.error('[WebAuthn Reg Start] HTTP error:', resp.status, errorText);
            throw new Error(`Failed to get registration options: ${resp.status}`);
        }
        
        const options = await resp.json();
        console.log('[WebAuthn Reg Start] Options received:', {
            challenge: options.challenge?.substring(0, 20) + '...',
            rpId: options.rpId,
            rpName: options.rp?.name,
            userName: options.user?.name,
            userVerification: options.authenticatorSelection?.userVerification,
            authenticatorAttachment: options.authenticatorSelection?.authenticatorAttachment,
            residentKey: options.authenticatorSelection?.residentKey,
        });

        // 2. Start browser ceremony
        let attResp;
        try {
            attResp = await startRegistration(options);
            console.log('[WebAuthn Reg] Credential created:', {
                id: attResp.id?.substring(0, 20) + '...',
                type: attResp.type,
            });
        } catch (error: any) {
            console.error('[WebAuthn Reg] create() failed:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                errorType: error instanceof DOMException ? 'DOMException' : typeof error,
                options: {
                    rpId: options.rpId,
                    authenticatorAttachment: options.authenticatorSelection?.authenticatorAttachment,
                },
            });
            throw error;
        }

        // 3. Verify with server
        const verificationResp = await fetch('/api/v1/auth/passkey/register/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attResp),
        });

        if (!verificationResp.ok) {
            const errorData = await verificationResp.json().catch(() => ({}));
            console.error('[WebAuthn Reg Finish] Verification failed:', {
                status: verificationResp.status,
                error: errorData,
            });
            throw new Error(errorData.message || 'Registration verification failed');
        }

        return await verificationResp.json();
    };

    const loginWithPasskey = async (username?: string) => {
        // 1. Get options from server
        const resp = await fetch('/api/v1/auth/passkey/login/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (!resp.ok) {
            const errorText = await resp.text();
            console.error('[WebAuthn Login Start] HTTP error:', resp.status, errorText);
            throw new Error(`Failed to get login options: ${resp.status}`);
        }
        
        const options = await resp.json();
        console.log('[WebAuthn Login Start] Options received:', {
            challenge: options.challenge?.substring(0, 20) + '...',
            rpId: options.rpId,
            allowCredentials: options.allowCredentials?.length || 0,
            userVerification: options.userVerification,
        });

        // 2. Start browser ceremony
        let asseResp;
        try {
            asseResp = await startAuthentication(options);
            console.log('[WebAuthn Login] Credential created:', {
                id: asseResp.id?.substring(0, 20) + '...',
                type: asseResp.type,
            });
        } catch (error: any) {
            console.error('[WebAuthn Login] create() failed:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                errorType: error instanceof DOMException ? 'DOMException' : typeof error,
                options: {
                    rpId: options.rpId,
                    allowCredentialsCount: options.allowCredentials?.length || 0,
                },
            });
            throw error;
        }

        // 3. Verify with server
        const verificationResp = await fetch('/api/v1/auth/passkey/login/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(asseResp),
        });

        if (!verificationResp.ok) {
            const errorData = await verificationResp.json().catch(() => ({}));
            console.error('[WebAuthn Login Finish] Verification failed:', {
                status: verificationResp.status,
                error: errorData,
            });
            throw new Error(errorData.message || 'Login verification failed');
        }

        return await verificationResp.json();
    };

    return {
        registerPasskey,
        loginWithPasskey,
        authenticateWithPasskey,
        isWebAuthnSupported,
    };
};
