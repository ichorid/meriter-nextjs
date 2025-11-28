export interface AuthenticatedUser {
  id: string;
  authProvider: string;
  authId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
}
