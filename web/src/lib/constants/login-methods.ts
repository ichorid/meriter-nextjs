/**
 * Product policy: expose only email magic-link sign-in in the login UI.
 * Test-auth mode keeps all methods for automated/manual QA.
 *
 * Telegram login/link is disabled (regulatory requirement).
 */
export const TELEGRAM_LOGIN_ENABLED = false;

export const EMAIL_ONLY_LOGIN = {
    enabledProviders: [] as string[],
    authnEnabled: false,
    smsEnabled: false,
    phoneEnabled: false,
} as const;

export function resolveLoginProviders(_oauth?: { telegram?: boolean }): string[] {
  return [];
}

export function isTelegramLoginEnabled(
  _oauth: { telegram?: boolean } | undefined,
  _botUsername: string | null | undefined,
): boolean {
  return TELEGRAM_LOGIN_ENABLED;
}
