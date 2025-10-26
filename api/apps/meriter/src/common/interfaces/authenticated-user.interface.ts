export interface AuthenticatedUser {
  id: string;
  tgUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
}
