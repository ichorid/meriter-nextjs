// Community entity types
import type { ID, Timestamp } from '../common';

export interface Community {
  uid: ID;
  identities: string[];
  administrators: string[];
  profile: {
    name?: string;
    description?: string;
    avatarUrl?: string;
  };
  meta: {
    iconUrl?: string;
    hashtagLabels?: string[];
  };
  deleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CommunityCreate {
  identities: string[];
  administrators: string[];
  profile: {
    name?: string;
    description?: string;
    avatarUrl?: string;
  };
  meta?: {
    iconUrl?: string;
    hashtagLabels?: string[];
  };
}

export interface CommunityUpdate {
  identities?: string[];
  administrators?: string[];
  profile?: {
    name?: string;
    description?: string;
    avatarUrl?: string;
  };
  meta?: {
    iconUrl?: string;
    hashtagLabels?: string[];
  };
  deleted?: boolean;
}