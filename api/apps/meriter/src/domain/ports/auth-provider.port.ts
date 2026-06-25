import type { User } from '../../domain/models/user/user.schema';

export const AUTH_PROVIDER_PORT = Symbol('AUTH_PROVIDER_PORT');

export type AuthSessionResult = {
  user: User;
  hasPendingCommunities: boolean;
  jwt: string;
  isNewUser?: boolean;
};

export type AuthProviderPort = {
  authenticateFakeUser(fakeUserId?: string): Promise<AuthSessionResult>;
  authenticateFakeCommunityUser(fakeUserId?: string): Promise<
    AuthSessionResult & { primaryTelegramCommunityId: string | null }
  >;
  authenticateFakeSuperadmin(fakeUserId?: string): Promise<AuthSessionResult>;
  authenticateDemoPersona(authId: string): Promise<AuthSessionResult>;
  authenticateTelegramWidget(
    data: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      auth_date: number;
      hash: string;
    },
    options?: { skipBaseCommunities?: boolean },
  ): Promise<
    AuthSessionResult & {
      primaryTelegramCommunityId: string | null;
    }
  >;
  authenticateSms(phoneNumber: string): Promise<AuthSessionResult>;
  authenticateEmail(email: string): Promise<AuthSessionResult>;
  authenticateGoogle(code: string): Promise<AuthSessionResult>;
  authenticateYandex(code: string): Promise<AuthSessionResult>;
  generatePasskeyRegistrationOptions(
    userId: string,
    username: string,
    displayName: string,
  ): Promise<unknown>;
  verifyPasskeyRegistration(
    userId: string,
    body: unknown,
  ): Promise<AuthSessionResult>;
  generatePasskeyLoginOptions(username?: string): Promise<unknown>;
  verifyPasskeyLogin(body: unknown): Promise<AuthSessionResult>;
  generatePasskeyAuthenticationOptions(): Promise<unknown>;
  authenticateWithPasskey(body: unknown): Promise<AuthSessionResult>;
};
