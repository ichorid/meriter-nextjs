// User entity types
import type { ID, Timestamp } from '../common';

export interface User {
  _id: ID;
  tgUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  avatarUrl?: string;
  name?: string;
  token?: string;
  init?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserProfile extends User {
  bio?: string;
  location?: string;
  website?: string;
  isAdmin?: boolean;
  isVerified?: boolean;
  joinDate: Timestamp;
  lastActive?: Timestamp;
}

export interface AuthUser extends User {
  token: string;
  expiresAt: Timestamp;
  refreshToken?: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface Session {
  user: AuthUser;
  token: string;
  expiresAt: Timestamp;
}

