/**
 * Product policy: expose only email magic-link sign-in in the login UI.
 * Test-auth mode keeps all methods for automated/manual QA.
 */
export const EMAIL_ONLY_LOGIN = {
    enabledProviders: [] as string[],
    authnEnabled: false,
    smsEnabled: false,
    phoneEnabled: false,
} as const;
